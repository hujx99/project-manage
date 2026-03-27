import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, InputNumber, Radio, Select, Space, Table, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface ParsedContract {
  contract_code?: string | null;
  contract_name?: string | null;
  procurement_type?: string | null;
  cost_department?: string | null;
  vendor?: string | null;
  amount?: number | null;
  amount_before_change?: number | null;
  sign_date?: string | null;
  filing_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  parent_contract_code?: string | null;
  renewal_type?: string | null;
  payment_direction?: string | null;
  status?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  filing_reference?: string | null;
  remark?: string | null;
}

interface ParsedItem {
  seq?: number | null;
  item_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  amount?: number | null;
}

interface ParsedPaymentPlan {
  seq?: number | null;
  phase?: string | null;
  planned_date?: string | null;
  planned_amount?: number | null;
  actual_date?: string | null;
  actual_amount?: number | null;
  payment_status?: string | null;
  description?: string | null;
  remark?: string | null;
}

interface ParsedChange {
  seq?: number | null;
  change_date?: string | null;
  change_info?: string | null;
  before_content?: string | null;
  after_content?: string | null;
  change_description?: string | null;
}

interface ParsedData {
  contract: ParsedContract;
  items: ParsedItem[];
  payment_plans: ParsedPaymentPlan[];
  changes: ParsedChange[];
}

const defaultParsedData: ParsedData = {
  contract: {},
  items: [],
  payment_plans: [],
  changes: [],
};

const highlightStyle = {
  backgroundColor: '#fff7e6',
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
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ParsedData>();
  const navigate = useNavigate();

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const nextFiles: UploadFile[] = [];
      Array.from(items).forEach((item, index) => {
        if (!item.type.startsWith('image/')) {
          return;
        }

        const file = item.getAsFile();
        if (!file) {
          return;
        }

        nextFiles.push({
          uid: `${Date.now()}-${index}`,
          name: file.name || `paste-${index}.png`,
          status: 'done',
          originFileObj: file as UploadFile['originFileObj'],
        });
      });

      if (nextFiles.length) {
        event.preventDefault();
        setFileList((current) => [...current, ...nextFiles]);
        message.success(`已粘贴 ${nextFiles.length} 张截图`);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const uncertainSet = useMemo(() => new Set(uncertainFields), [uncertainFields]);

  const fieldStyle = (path: string) => (uncertainSet.has(path) ? highlightStyle : undefined);

  const startRecognition = async () => {
    const files = fileList.map((item) => item.originFileObj).filter(Boolean) as File[];
    if (!files.length) {
      message.warning('请先上传截图');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    setRecognizing(true);
    try {
      const response = await client.post('/import/screenshot', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = {
        ...defaultParsedData,
        ...response.data.parsed_data,
      } as ParsedData;
      setParsedData(data);
      setUncertainFields(response.data.uncertain_fields || []);
      form.setFieldsValue(data);
      message.success('识别完成，请检查结果后导入');
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setRecognizing(false);
    }
  };

  const confirmImport = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const response = await client.post('/import/screenshot/confirm', {
        parsed_data: values,
      });
      message.success('导入成功');
      navigate(`/contracts/${response.data.contract_id}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = (entity: 'projects' | 'contracts' | 'payments') => {
    window.open(`http://localhost:8000/api/import/template/${entity}`, '_blank');
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
      const response = await client.post(`/import/excel/${importEntity}?duplicate_action=${duplicateAction}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExcelResult(response.data);
      message.success('Excel 导入完成');
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setExcelImportLoading(false);
    }
  };

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          数据导入
        </Typography.Title>
        <Typography.Text type="secondary">
          支持上传或粘贴 OA 合同截图，识别后可人工校正再导入数据库。
        </Typography.Text>
      </div>

      <Card className="page-panel" title="Excel导入">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
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
            maxCount={1}
            fileList={excelFileList}
            onChange={({ fileList: nextFileList }) => setExcelFileList(nextFileList)}
          >
            <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域上传</p>
            <p className="ant-upload-hint">仅支持 .xlsx 格式</p>
          </Upload.Dragger>
          <Space>
            <Button type="primary" loading={excelImportLoading} onClick={() => void startExcelImport()}>
              开始 Excel 导入
            </Button>
            <Button onClick={() => setExcelFileList([])}>清空文件</Button>
          </Space>
          {excelResult && (
            <Card size="small" title="导入结果">
              <Space wrap size="large" style={{ marginBottom: 12 }}>
                <Typography.Text>成功：{excelResult.success}</Typography.Text>
                <Typography.Text>失败：{excelResult.failed}</Typography.Text>
                <Typography.Text>跳过：{excelResult.skipped}</Typography.Text>
              </Space>
              <Table
                rowKey={(record) => `${record.row}-${record.message}`}
                dataSource={excelResult.errors}
                pagination={false}
                locale={{ emptyText: '没有错误明细' }}
                columns={[
                  { title: '行号', dataIndex: 'row', width: 120 },
                  { title: '错误信息', dataIndex: 'message' },
                ]}
              />
            </Card>
          )}
        </Space>
      </Card>

      <Card className="page-panel" title="AI截图识别">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Alert
            type="info"
            showIcon
            message="支持拖拽上传和 Ctrl/Cmd + V 粘贴截图，可一次选择多张图片。"
          />
          <Upload.Dragger
            multiple
            accept="image/*"
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽截图到此区域上传</p>
            <p className="ant-upload-hint">支持多张截图联合识别</p>
          </Upload.Dragger>
          <Space>
            <Button type="primary" loading={recognizing} onClick={() => void startRecognition()}>
              开始识别
            </Button>
            <Button onClick={() => setFileList([])}>清空截图</Button>
          </Space>
        </Space>
      </Card>

      {parsedData && (
        <Card className="page-panel" title="识别结果确认">
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="warning"
              showIcon
              message="黄色字段表示 AI 不确定，建议重点核对。"
            />

            <Form layout="vertical" form={form} initialValues={parsedData}>
              <Typography.Title level={4}>合同信息</Typography.Title>
              <div className="inline-editor" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <Form.Item label="项目编号" name={['contract', 'project_code']}>
                  <Input style={fieldStyle('contract.project_code')} />
                </Form.Item>
                <Form.Item label="项目名称" name={['contract', 'project_name']}>
                  <Input style={fieldStyle('contract.project_name')} />
                </Form.Item>
                <Form.Item label="合同编号" name={['contract', 'contract_code']} rules={[{ required: true, message: '请输入合同编号' }]}>
                  <Input style={fieldStyle('contract.contract_code')} />
                </Form.Item>
                <Form.Item label="合同名称" name={['contract', 'contract_name']} rules={[{ required: true, message: '请输入合同名称' }]}>
                  <Input style={fieldStyle('contract.contract_name')} />
                </Form.Item>
                <Form.Item label="采购类型" name={['contract', 'procurement_type']}>
                  <Input style={fieldStyle('contract.procurement_type')} />
                </Form.Item>
                <Form.Item label="费用归属责任中心" name={['contract', 'cost_department']}>
                  <Input style={fieldStyle('contract.cost_department')} />
                </Form.Item>
                <Form.Item label="供应商" name={['contract', 'vendor']}>
                  <Input style={fieldStyle('contract.vendor')} />
                </Form.Item>
                <Form.Item label="合同金额" name={['contract', 'amount']}>
                  <InputNumber style={{ width: '100%', ...fieldStyle('contract.amount') }} />
                </Form.Item>
                <Form.Item label="变更前金额" name={['contract', 'amount_before_change']}>
                  <InputNumber style={{ width: '100%', ...fieldStyle('contract.amount_before_change') }} />
                </Form.Item>
                <Form.Item label="签订日期" name={['contract', 'sign_date']}>
                  <Input placeholder="YYYY-MM-DD" style={fieldStyle('contract.sign_date')} />
                </Form.Item>
                <Form.Item label="备案日期" name={['contract', 'filing_date']}>
                  <Input placeholder="YYYY-MM-DD" style={fieldStyle('contract.filing_date')} />
                </Form.Item>
                <Form.Item label="开始执行日期" name={['contract', 'start_date']}>
                  <Input placeholder="YYYY-MM-DD" style={fieldStyle('contract.start_date')} />
                </Form.Item>
                <Form.Item label="结束执行日期" name={['contract', 'end_date']}>
                  <Input placeholder="YYYY-MM-DD" style={fieldStyle('contract.end_date')} />
                </Form.Item>
                <Form.Item label="主合同编号" name={['contract', 'parent_contract_code']}>
                  <Input style={fieldStyle('contract.parent_contract_code')} />
                </Form.Item>
                <Form.Item label="合同续签类型" name={['contract', 'renewal_type']}>
                  <Input style={fieldStyle('contract.renewal_type')} />
                </Form.Item>
                <Form.Item label="收支方向" name={['contract', 'payment_direction']}>
                  <Input style={fieldStyle('contract.payment_direction')} />
                </Form.Item>
                <Form.Item label="合同状态" name={['contract', 'status']} rules={[{ required: true, message: '请输入合同状态' }]}>
                  <Input style={fieldStyle('contract.status')} />
                </Form.Item>
                <Form.Item label="备案文件" name={['contract', 'filing_reference']}>
                  <Input style={fieldStyle('contract.filing_reference')} />
                </Form.Item>
                <Form.Item label="备注" name={['contract', 'remark']}>
                  <Input.TextArea rows={2} style={fieldStyle('contract.remark')} />
                </Form.Item>
              </div>

              <Typography.Title level={4}>标的清单</Typography.Title>
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
                              <InputNumber style={{ width: 90, ...fieldStyle(`items[${field.name}].seq`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '标的名称',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'item_name']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`items[${field.name}].item_name`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '数量',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'quantity']} style={{ marginBottom: 0 }}>
                              <InputNumber style={{ width: 100, ...fieldStyle(`items[${field.name}].quantity`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '单位',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'unit']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`items[${field.name}].unit`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '单价',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'unit_price']} style={{ marginBottom: 0 }}>
                              <InputNumber style={{ width: 120, ...fieldStyle(`items[${field.name}].unit_price`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '金额',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'amount']} style={{ marginBottom: 0 }}>
                              <InputNumber style={{ width: 120, ...fieldStyle(`items[${field.name}].amount`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '操作',
                          width: 100,
                          render: (_, field) => (
                            <Button type="link" danger onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          ),
                        },
                      ]}
                    />
                    <Button style={{ marginTop: 12 }} onClick={() => add({ seq: fields.length + 1 })}>
                      新增标的
                    </Button>
                  </>
                )}
              </Form.List>

              <Typography.Title level={4}>付款计划</Typography.Title>
              <Form.List name="payment_plans">
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
                              <InputNumber style={{ width: 80, ...fieldStyle(`payment_plans[${field.name}].seq`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '阶段',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'phase']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`payment_plans[${field.name}].phase`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '计划日期',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'planned_date']} style={{ marginBottom: 0 }}>
                              <Input placeholder="YYYY-MM-DD" style={fieldStyle(`payment_plans[${field.name}].planned_date`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '计划金额',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'planned_amount']} style={{ marginBottom: 0 }}>
                              <InputNumber style={{ width: 120, ...fieldStyle(`payment_plans[${field.name}].planned_amount`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '状态',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'payment_status']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`payment_plans[${field.name}].payment_status`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '说明',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'description']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`payment_plans[${field.name}].description`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '操作',
                          width: 100,
                          render: (_, field) => (
                            <Button type="link" danger onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          ),
                        },
                      ]}
                    />
                    <Button style={{ marginTop: 12 }} onClick={() => add({ seq: fields.length + 1, payment_status: '未付' })}>
                      新增付款计划
                    </Button>
                  </>
                )}
              </Form.List>

              <Typography.Title level={4}>变更记录</Typography.Title>
              <Form.List name="changes">
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
                              <InputNumber style={{ width: 80, ...fieldStyle(`changes[${field.name}].seq`) }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '变更日期',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'change_date']} style={{ marginBottom: 0 }}>
                              <Input placeholder="YYYY-MM-DD" style={fieldStyle(`changes[${field.name}].change_date`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '变更信息',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'change_info']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`changes[${field.name}].change_info`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '变更说明',
                          render: (_, field) => (
                            <Form.Item name={[field.name, 'change_description']} style={{ marginBottom: 0 }}>
                              <Input style={fieldStyle(`changes[${field.name}].change_description`)} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '操作',
                          width: 100,
                          render: (_, field) => (
                            <Button type="link" danger onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          ),
                        },
                      ]}
                    />
                    <Button style={{ marginTop: 12 }} onClick={() => add({ seq: fields.length + 1 })}>
                      新增变更记录
                    </Button>
                  </>
                )}
              </Form.List>
            </Form>

            <Space>
              <Button type="primary" loading={submitting} onClick={() => void confirmImport()}>
                导入
              </Button>
              <Button
                onClick={() => {
                  setParsedData(null);
                  form.resetFields();
                }}
              >
                取消本次结果
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default ImportsPage;
