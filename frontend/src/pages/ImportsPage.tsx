import { InboxOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface ParsedData {
  contract: Record<string, unknown>;
  items: Record<string, unknown>[];
  payment_plans: Record<string, unknown>[];
  changes: Record<string, unknown>[];
}

const defaultParsedData: ParsedData = {
  contract: {},
  items: [],
  payment_plans: [],
  changes: [],
};

const uncertainStyle: CSSProperties = {
  background: '#fffbe6',
  borderColor: '#faad14',
};

const ImportsPage = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [excelFileList, setExcelFileList] = useState<UploadFile[]>([]);
  const [importEntity, setImportEntity] = useState<'projects' | 'contracts' | 'payments'>('projects');
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<{
    success: number;
    failed: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageFiles: UploadFile[] = [];
      Array.from(items).forEach((item, index) => {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push({
              uid: `${Date.now()}-${index}`,
              name: file.name || `paste-${index}.png`,
              status: 'done',
              originFileObj: file as unknown as UploadFile['originFileObj'],
            });
          }
        }
      });
      if (imageFiles.length) {
        event.preventDefault();
        setFileList((prev) => [...prev, ...imageFiles]);
        message.success(`已粘贴 ${imageFiles.length} 张截图`);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const startRecognition = async () => {
    const files = fileList.map((item) => item.originFileObj).filter(Boolean) as File[];
    if (!files.length) {
      message.warning('请先上传截图');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    setLoading(true);
    try {
      const response = await client.post('/import/screenshot', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = response.data;
      const data: ParsedData = {
        ...defaultParsedData,
        ...(result.parsed_data || {}),
      };
      setParsedData(data);
      setUncertainFields(result.uncertain_fields || []);
      form.setFieldsValue({
        contract: data.contract,
        items: data.items,
        payment_plans: data.payment_plans,
        changes: data.changes,
      });
      message.success('识别完成，请检查后导入');
    } catch (error) {
      message.error((error as Error).message || '识别失败');
    } finally {
      setLoading(false);
    }
  };

  const uncertainSet = useMemo(() => new Set(uncertainFields), [uncertainFields]);

  const fieldStyle = (path: string) => (uncertainSet.has(path) ? uncertainStyle : undefined);

  const downloadTemplate = (entity: 'projects' | 'contracts' | 'payments') => {
    window.open(`/api/import/template/${entity}`, '_blank');
  };

  const startExcelImport = async () => {
    const file = excelFileList[0]?.originFileObj as File | undefined;
    if (!file) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setExcelImportLoading(true);
    try {
      const response = await client.post(
        `/import/excel/${importEntity}?duplicate_action=${duplicateAction}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setExcelResult(response.data);
      message.success('Excel 导入完成');
    } catch (error) {
      message.error((error as Error).message || 'Excel 导入失败');
    } finally {
      setExcelImportLoading(false);
    }
  };

  const onConfirmImport = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const response = await client.post('/import/screenshot/confirm', {
        parsed_data: values,
      });
      message.success('导入成功');
      navigate(`/contracts/${response.data.contract_id}`);
    } catch (error) {
      message.error((error as Error).message || '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title="Excel导入">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Button onClick={() => downloadTemplate('projects')}>下载项目模板</Button>
            <Button onClick={() => downloadTemplate('contracts')}>下载合同模板</Button>
            <Button onClick={() => downloadTemplate('payments')}>下载付款模板</Button>
          </Space>
          <Space wrap>
            <Radio.Group
              value={importEntity}
              onChange={(event) => setImportEntity(event.target.value)}
              options={[
                { label: '项目', value: 'projects' },
                { label: '合同', value: 'contracts' },
                { label: '付款', value: 'payments' },
              ]}
            />
            <Select
              value={duplicateAction}
              style={{ width: 220 }}
              onChange={(value) => setDuplicateAction(value)}
              options={[
                { label: '重复编号跳过', value: 'skip' },
                { label: '重复编号更新', value: 'update' },
              ]}
            />
          </Space>
          <Upload.Dragger
            accept=".xlsx"
            beforeUpload={() => false}
            fileList={excelFileList}
            maxCount={1}
            onChange={({ fileList: next }) => setExcelFileList(next)}
          >
            <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域上传</p>
            <p className="ant-upload-hint">仅支持 .xlsx 格式</p>
          </Upload.Dragger>
          <Space>
            <Button type="primary" loading={excelImportLoading} onClick={startExcelImport}>
              开始 Excel 导入
            </Button>
            <Button onClick={() => setExcelFileList([])}>清空</Button>
          </Space>
          {excelResult && (
            <Card size="small" title="导入结果">
              <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="成功">{excelResult.success}</Descriptions.Item>
                <Descriptions.Item label="失败">{excelResult.failed}</Descriptions.Item>
                <Descriptions.Item label="跳过">{excelResult.skipped}</Descriptions.Item>
              </Descriptions>
              <Table
                style={{ marginTop: 12 }}
                size="small"
                rowKey={(record) => `${record.row}-${record.message}`}
                pagination={false}
                dataSource={excelResult.errors}
                columns={[
                  { title: '行号', dataIndex: 'row', width: 120 },
                  { title: '错误信息', dataIndex: 'message' },
                ]}
              />
            </Card>
          )}
        </Space>
      </Card>

      <Card title="AI截图识别">
        <Alert
          message="支持拖拽/点击上传，或直接 Ctrl/Cmd+V 粘贴截图（可多张）。"
          type="info"
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          multiple
          accept="image/*"
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList: next }) => setFileList(next)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽截图到此区域上传</p>
          <p className="ant-upload-hint">支持 PNG / JPG / JPEG，支持多张截图拼接识别</p>
        </Upload.Dragger>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" onClick={startRecognition} loading={loading}>
            开始识别
          </Button>
          <Button onClick={() => setFileList([])}>清空</Button>
          <Tag color="blue">已选 {fileList.length} 张</Tag>
        </Space>
      </Card>

      {parsedData && (
        <Card title="识别结果确认">
          <Typography.Paragraph type="secondary">
            黄色字段表示 AI 不确定，建议重点核对。
          </Typography.Paragraph>
          <Form layout="vertical" form={form} initialValues={parsedData}>
            <Typography.Title level={5}>合同信息</Typography.Title>
            <Space wrap style={{ width: '100%' }}>
              <Form.Item name={['contract', 'contract_code']} label="合同编号" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.contract_code')} />
              </Form.Item>
              <Form.Item name={['contract', 'contract_name']} label="合同名称" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.contract_name')} />
              </Form.Item>
              <Form.Item name={['contract', 'project_code']} label="项目编号" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.project_code')} />
              </Form.Item>
              <Form.Item name={['contract', 'project_name']} label="项目名称" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.project_name')} />
              </Form.Item>
              <Form.Item name={['contract', 'vendor']} label="供应商" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.vendor')} />
              </Form.Item>
              <Form.Item name={['contract', 'amount']} label="合同金额" style={{ minWidth: 280 }}>
                <InputNumber style={{ width: '100%', ...fieldStyle('contract.amount') }} />
              </Form.Item>
              <Form.Item name={['contract', 'status']} label="合同状态" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.status')} />
              </Form.Item>
              <Form.Item name={['contract', 'payment_direction']} label="收支方向" style={{ minWidth: 280 }}>
                <Input style={fieldStyle('contract.payment_direction')} />
              </Form.Item>
            </Space>

            <Typography.Title level={5}>标的清单</Typography.Title>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  <Table
                    rowKey="key"
                    pagination={false}
                    dataSource={fields}
                    columns={[
                      {
                        title: '序号',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'seq']} style={{ marginBottom: 0 }}>
                            <InputNumber style={{ width: 100 }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '标的名称',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'item_name']} style={{ marginBottom: 0 }}>
                            <Input />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '金额',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'amount']} style={{ marginBottom: 0 }}>
                            <InputNumber style={{ width: 120 }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '操作',
                        render: (_, field) => <Button onClick={() => remove(field.name)}>删除</Button>,
                      },
                    ]}
                  />
                  <Button style={{ marginTop: 8 }} onClick={() => add({ seq: fields.length + 1 })}>
                    新增标的
                  </Button>
                </>
              )}
            </Form.List>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              付款计划
            </Typography.Title>
            <Form.List name="payment_plans">
              {(fields, { add, remove }) => (
                <>
                  <Table
                    rowKey="key"
                    pagination={false}
                    dataSource={fields}
                    columns={[
                      {
                        title: '期次',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'seq']} style={{ marginBottom: 0 }}>
                            <InputNumber style={{ width: 90 }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '阶段',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'phase']} style={{ marginBottom: 0 }}>
                            <Input />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '计划日期',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'planned_date']} style={{ marginBottom: 0 }}>
                            <Input placeholder="YYYY-MM-DD" />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '金额',
                        render: (_, field) => (
                          <Form.Item name={[field.name, 'planned_amount']} style={{ marginBottom: 0 }}>
                            <InputNumber style={{ width: 120 }} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '操作',
                        render: (_, field) => <Button onClick={() => remove(field.name)}>删除</Button>,
                      },
                    ]}
                  />
                  <Button style={{ marginTop: 8 }} onClick={() => add({ seq: fields.length + 1 })}>
                    新增计划
                  </Button>
                </>
              )}
            </Form.List>

            <Button type="primary" loading={submitting} onClick={onConfirmImport} style={{ marginTop: 20 }}>
              导入
            </Button>
          </Form>
        </Card>
      )}
    </Space>
  );
};

export default ImportsPage;
