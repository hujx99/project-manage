import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { fetchAISettings, updateAISettings } from '../services/settings';
import type { AISettings } from '../services/settings';

const PROVIDERS = [
  { label: 'Anthropic Claude', value: 'anthropic' },
  { label: 'OpenAI 兼容（通义千问、豆包、DeepSeek 等）', value: 'openai_compatible' },
];

// 仅列出支持图片识别（视觉模型）的供应商
const PRESET_URLS = [
  { label: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
  { label: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v' },
  { label: 'Moonshot (Kimi)', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k-vision-preview' },
  { label: '豆包', url: 'https://ark.cn-beijing.volces.com/api/v3', model: '（填推理接入点 ID，如 ep-xxx）' },
];

const SettingsPage = () => {
  const [form] = Form.useForm<AISettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const provider = Form.useWatch('provider', form);

  useEffect(() => {
    fetchAISettings()
      .then((data) => form.setFieldsValue(data))
      .catch(() => message.error('加载配置失败'))
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateAISettings(values);
      message.success('配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          系统设置
        </Typography.Title>
        <Typography.Text type="secondary">配置 AI 截图识别所使用的模型和密钥。</Typography.Text>
      </div>

      <Card title="AI 识别配置" loading={loading} style={{ maxWidth: 640 }}>
        <Form form={form} layout="vertical">
          <Form.Item label="AI 提供商" name="provider" rules={[{ required: true }]}>
            <Select options={PROVIDERS} />
          </Form.Item>

          <Form.Item
            label="API Key"
            name="api_key"
            rules={[{ required: true, message: '请填写 API Key' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          {provider === 'openai_compatible' && (
            <>
              <Form.Item
                label="API 地址"
                name="base_url"
                rules={[{ required: true, message: '请填写 API 地址' }]}
                extra={
                  <Space wrap style={{ marginTop: 6 }}>
                    {PRESET_URLS.map((p) => (
                      <Button
                        key={p.label}
                        size="small"
                        onClick={() => {
                          form.setFieldValue('base_url', p.url);
                          form.setFieldValue('model', p.model);
                        }}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </Space>
                }
              >
                <Input placeholder="https://..." />
              </Form.Item>

              <Form.Item
                label="模型名称"
                name="model"
                rules={[{ required: true, message: '请填写模型名称' }]}
                extra="支持图片识别的模型：通义千问填 qwen-vl-max，智谱填 glm-4v，豆包填推理接入点 ID（ep-xxx）"
              >
                <Input placeholder="模型名称" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Button type="primary" onClick={() => void handleSave()} loading={saving}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPage;
