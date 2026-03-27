import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Contract, ContractItem, Payment, ContractChange } from '../types';
import {
  fetchContract,
  createContractItem,
  deleteContractItem,
  createContractChange,
  deleteContractChange,
} from '../services/contracts';
import { createPayment, deletePayment } from '../services/payments';


const PAYMENT_STATUSES = ['未付', '已提交', '已付款'];

const ContractDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [itemForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [changeForm] = Form.useForm();

  const loadContract = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchContract(Number(id));
      setContract(data);
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const itemTotalAmount = useMemo(
    () => (contract?.items ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
    [contract?.items],
  );

  const paymentPaidAmount = useMemo(
    () => (contract?.payments ?? []).reduce((sum, p) => sum + Number(p.actual_amount || 0), 0),
    [contract?.payments],
  );

  const contractAmount = Number(contract?.amount ?? 0);
  const isItemTotalMismatch = contract?.items?.length && Math.abs(itemTotalAmount - contractAmount) > 0.01;
  const isPaymentExceed = paymentPaidAmount - contractAmount > 0.01;

  // Handlers
  const handleAddItem = async () => {
    const values = await itemForm.validateFields();
    setSubmitting(true);
    try {
      const nextSeq = (contract?.items?.length ?? 0) + 1;
      await createContractItem(Number(id), {
        seq: nextSeq,
        item_name: values.item_name,
        quantity: values.quantity,
        unit: values.unit,
        unit_price: values.unit_price,
        amount: values.amount,
      });
      message.success('添加成功');
      setItemModalOpen(false);
      itemForm.resetFields();
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await deleteContractItem(Number(id), itemId);
      message.success('删除成功');
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    }
  };

  const handleAddPayment = async () => {
    const values = await paymentForm.validateFields();
    setSubmitting(true);
    try {
      const nextSeq = (contract?.payments?.length ?? 0) + 1;
      await createPayment({
        contract_id: Number(id),
        seq: nextSeq,
        phase: values.phase,
        planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined,
        planned_amount: values.planned_amount,
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : undefined,
        actual_amount: values.actual_amount,
        payment_status: values.payment_status,
        description: values.description,
      });
      message.success('添加成功');
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await deletePayment(paymentId);
      message.success('删除成功');
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    }
  };

  const handleAddChange = async () => {
    const values = await changeForm.validateFields();
    setSubmitting(true);
    try {
      const nextSeq = (contract?.changes?.length ?? 0) + 1;
      await createContractChange(Number(id), {
        seq: nextSeq,
        change_date: values.change_date.format('YYYY-MM-DD'),
        change_info: values.change_info,
        before_content: values.before_content,
        after_content: values.after_content,
        change_description: values.change_description,
      });
      message.success('添加成功');
      setChangeModalOpen(false);
      changeForm.resetFields();
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChange = async (changeId: number) => {
    try {
      await deleteContractChange(Number(id), changeId);
      message.success('删除成功');
      void loadContract();
    } catch (e: unknown) {
      message.error((e as Error).message);
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 100 }} />;
  if (!contract) return <Typography.Text>合同不存在</Typography.Text>;

  // Column definitions
  const itemColumns: ColumnsType<ContractItem> = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '标的名称', dataIndex: 'item_name' },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    {
      title: '单价',
      dataIndex: 'unit_price',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      render: (v: number) => `¥${Number(v).toLocaleString()}`,
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确认删除?" onConfirm={() => handleDeleteItem(record.id)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '付款阶段', dataIndex: 'phase', width: 120 },
    { title: '计划日期', dataIndex: 'planned_date', width: 120 },
    {
      title: '计划金额',
      dataIndex: 'planned_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    { title: '实际日期', dataIndex: 'actual_date', width: 120 },
    {
      title: '实际金额',
      dataIndex: 'actual_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '待付金额',
      dataIndex: 'pending_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'payment_status',
      width: 90,
      render: (v: string) => {
        const color = v === '已付款' ? 'success' : v === '已提交' ? 'processing' : 'default';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确认删除?" onConfirm={() => handleDeletePayment(record.id)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const changeColumns: ColumnsType<ContractChange> = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '变更日期', dataIndex: 'change_date', width: 120 },
    { title: '变更信息', dataIndex: 'change_info' },
    { title: '变更前', dataIndex: 'before_content' },
    { title: '变更后', dataIndex: 'after_content' },
    { title: '说明', dataIndex: 'change_description' },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确认删除?" onConfirm={() => handleDeleteChange(record.id)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Card title={`合同详情：${contract.contract_name}`} style={{ marginBottom: 16 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="合同编号">{contract.contract_code}</Descriptions.Item>
          <Descriptions.Item label="供应商">{contract.vendor || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{contract.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="合同金额">{`¥${Number(contract.amount).toLocaleString()}`}</Descriptions.Item>
          <Descriptions.Item label="收支方向">{contract.payment_direction || '-'}</Descriptions.Item>
          <Descriptions.Item label="签订日期">{contract.sign_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始日期">{contract.start_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{contract.end_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="采购类型">{contract.procurement_type || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {isItemTotalMismatch && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message={`标的合计（¥${itemTotalAmount.toLocaleString()}）与合同金额（¥${contractAmount.toLocaleString()}）不一致，请复核。`}
        />
      )}
      {isPaymentExceed && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message={`已付款总额（¥${paymentPaidAmount.toLocaleString()}）超过合同金额（¥${contractAmount.toLocaleString()}），请检查付款数据。`}
        />
      )}

      <Tabs
        items={[
          {
            key: '1',
            label: `标的清单 (${contract.items.length})`,
            children: (
              <>
                <Button type="primary" style={{ marginBottom: 12 }} onClick={() => {
                  itemForm.resetFields();
                  setItemModalOpen(true);
                }}>
                  新增标的
                </Button>
                <Table rowKey="id" pagination={false} dataSource={contract.items} columns={itemColumns} />
                <div style={{ marginTop: 8, textAlign: 'right', fontWeight: 'bold' }}>
                  合计：¥{itemTotalAmount.toLocaleString()}
                </div>
              </>
            ),
          },
          {
            key: '2',
            label: `付款计划 (${contract.payments.length})`,
            children: (
              <>
                <Button type="primary" style={{ marginBottom: 12 }} onClick={() => {
                  paymentForm.resetFields();
                  setPaymentModalOpen(true);
                }}>
                  新增付款
                </Button>
                <Table rowKey="id" pagination={false} dataSource={contract.payments} columns={paymentColumns} />
              </>
            ),
          },
          {
            key: '3',
            label: `变更记录 (${contract.changes.length})`,
            children: (
              <>
                <Button type="primary" style={{ marginBottom: 12 }} onClick={() => {
                  changeForm.resetFields();
                  setChangeModalOpen(true);
                }}>
                  新增变更
                </Button>
                <Table rowKey="id" pagination={false} dataSource={contract.changes} columns={changeColumns} />
              </>
            ),
          },
        ]}
      />

      {/* Add Item Modal */}
      <Modal
        title="新增标的"
        open={itemModalOpen}
        onCancel={() => setItemModalOpen(false)}
        onOk={handleAddItem}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={itemForm}>
          <Form.Item label="标的名称" name="item_name" rules={[{ required: true, message: '请输入标的名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input placeholder="个/台/套/项" />
          </Form.Item>
          <Form.Item label="单价" name="unit_price">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Payment Modal */}
      <Modal
        title="新增付款"
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={handleAddPayment}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={paymentForm}>
          <Form.Item label="付款阶段" name="phase">
            <Input placeholder="如：第一期、质保金" />
          </Form.Item>
          <Form.Item label="计划日期" name="planned_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划金额" name="planned_amount">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="实际日期" name="actual_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="实际金额" name="actual_amount">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="付款状态" name="payment_status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={PAYMENT_STATUSES.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Change Modal */}
      <Modal
        title="新增变更记录"
        open={changeModalOpen}
        onCancel={() => setChangeModalOpen(false)}
        onOk={handleAddChange}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={changeForm}>
          <Form.Item label="变更日期" name="change_date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="变更信息" name="change_info">
            <Input />
          </Form.Item>
          <Form.Item label="变更前内容" name="before_content">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="变更后内容" name="after_content">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="变更说明" name="change_description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ContractDetailPage;
