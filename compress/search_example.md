These are the semantic search results. Note that these may or may not include the full answer. It is up to you to decide if you need to call more tools to gather more information.

```src/pages/options/Options.tsx
1|import React, { useState, useEffect } from 'react';
import ConfigManager from '@src/components/config/ConfigManager';
import {
  USER_TOOLS_KEY,
  USER_MODELS_KEY,
  USER_CHAT_PRESETS_KEY,
  USER_PREFERENCES_KEY,
} from '@src/utils/StorageManager';
import { getVersion } from '@src/utils/version';
import ExternalLinksManager, { ExternalLinks } from '@src/utils/ExternalLinksManager';

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Models');
  const [showWechatImage, setShowWechatImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [links, setLinks] = useState<ExternalLinks | null>(null);
  const version = getVersion();

  useEffect(() => {
    ExternalLinksManager.loadLinks()
      .then(setLinks)
      .catch(error => console.error('Failed to load external links:', error));
  }, []);

  const tabs = ['Models', 'System Prompt', 'Prompts', 'Preferences'];

  const handleImageLoad = () => {
    setImageLoaded(true);
29|  };
...
...
...
12|const Options: React.FC = () => {
12|const Options: React.FC = () => {
12|const Options: React.FC = () => {
13|  const [activeTab, setActiveTab] = useState('Models');


  ...
64|

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 顶部栏 */}
      <header className="flex justify-between items-center p-8 pl-16 pr-16 mb-4 bg-white shadow">
        <h1 className="text-xl font-bold flex items-center">
          Askman<span className="font-normal text-gray-500">(v{version})</span>
          <div className="flex items-center">
            <a
              href={links?.docs.issues}
              className="ml-2 bg-black font-normal text-white px-2 py-1 text-sm rounded"
              target="_blank"
              rel="noopener noreferrer">
              Roadmap
            </a>
            <div className="relative ml-2 flex items-center">
              <button
                className="bg-green-500 text-white px-2 py-1 text-sm rounded hover:bg-green-600"
                onMouseEnter={() => setShowWechatImage(true)}
                onMouseLeave={() => {
                  setShowWechatImage(false);
                  setImageLoaded(false);
                }}>
                WeChat: {links?.social.wechat_id}
              </button>
              {showWechatImage && (
                <div className="absolute left-0 top-full mt-2 z-50 w-[150px] h-[150px] bg-white rounded shadow-lg p-4">
                  {!imageLoaded && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    </div>
                  )}
                  <img
                    src={links?.social.wechat_qr}
                    alt="WeChat QR Code"
                    className={`w-full h-full object-contain rounded transition-opacity duration-300 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={handleImageLoad}
                  />
                </div>
106|              )}
...

```

```src/assets/conf/models.toml
1|# [provider]: A group identifier for model configurations
# The name here can be customized without affecting the actual API request
# For example, [chatglm] can be renamed to [gem] or [paid-openai]
# Just ensure it's unique within this config file
[siliconflow]
# The protocol used to send requests, currently only supporting openai, is HTTPS
sdk = "openai" 
# API key, left empty here
api_key = "sk-xxx" 
# Base URL for API requests
base_url = "https://extapi.askman.dev/v1/"
send_api_key = false
cloudflare_gateway_url = ""
models = [
  { name = "THUDM/glm-4-9b-chat", max_tokens = 32768 } # THUDM/glm-4-9b-chat via siliconflow
]
[openrouter]
api_key = "sk-xxx"
base_url = "https://extapi.askman.dev/v1/"
sdk = "openai"
send_api_key = true
models = [
  { max_tokens = 32786, name = "meta-llama/llama-3.1-405b-instruct:free" },
  { max_tokens = 32786, name = "qwen/qwen-2-7b-instruct:free" },
  { max_tokens = 32786, name = "google/gemma-2-9b-it:free" }
]

# [openai]
# sdk = "openai"  # Protocol used to send requests
# api_key = "sk-xxx" # Your OpenAI API key
# base_url = "https://api.openai.com/v1" # Concatenation logic is {base_url}/chat/completions
# send_api_key = true # Whether to include the API Key in headers
# cloudflare_gateway_url = "" # Use Cloudflare Gateway proxy
# models = [
#   { name = "gpt-3.5-turbo", max_tokens = 4096 },
#   { name = "gpt-4", max_tokens = 8192 }
# ]

# The following is not yet supported
# [azure]
# api_key = ""
# endpoint = ""
# models = [
#   { name = "gpt-3.5-turbo", max_tokens = 4096 },
#   { name = "gpt-4", max_tokens = 8192 }
# ]

# [anthropic]
# api_key = ""
# models = [
#   { name = "claude-2", max_tokens = 100000 },
#   { name = "claude-instant-1", max_tokens = 100000 }
# ]

# [google]
# api_key = ""
# models = [
#   { name = "gemini-pro", max_tokens = 30720 },
#   { name = "text-bison", max_tokens = 8192 }
# ]

# [groq]
# api_key = ""
# models = [
#   { name = "llama2-70b-4096", max_tokens = 4096 },
#   { name = "mixtral-8x7b-32768", max_tokens = 32768 }
# ]

# [ollama]
# api_base = "http://localhost:11434"
# models = [
#   { name = "llama2", max_tokens = 4096 },
#   { name = "mistral", max_tokens = 8192 }
# ]

# [openrouter]
# api_key = ""
# models = []
79|
...

```

```src/components/ask/ModelDropDown.tsx
1|import React, { useEffect, useState, useRef } from 'react';
import configStorage from '@src/shared/storages/configStorage';
import { BaseDropdown } from '../base/BaseDropdown';

interface ModelDropdownProps {
  className?: string;
  onItemClick: (_model: string, _withCommand?: boolean) => void;
  statusListener: (_status: boolean) => void;
  initOpen: boolean;
}

interface ModelItem {
  id: string;
  name: string;
  shortName: string;
  provider: string;
}

export default function ModelDropdown({ className, onItemClick, statusListener, initOpen }: ModelDropdownProps) {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string>('free'); // 默认显示 free
  const baseDropdownRef = useRef<HTMLDivElement>(null);

  // 辅助函数：简化模型名称显示
  const simplifyModelName = (name: string): string => {
    if (!name) return name;
    const parts = name.split('/').filter(part => part.trim() !== '');
    if (parts.length === 0) return name;
    return parts[parts.length - 1] || parts[parts.length - 2] || name;
  };

  useEffect(() => {
    const fetchModels = async () => {
      const userModels = (await configStorage.getModelConfig()) || [];
      const modelArray: ModelItem[] = [];
      userModels.forEach(({ provider, config }) => {
        if (config.models) {
          config.models.forEach(m => {
            modelArray.push({
              id: provider + '/' + (m.name || m.id),
              name: provider + '/' + (m.name || m.id),
              shortName: m.name || m.id,
              provider,
            });
          });
        }
      });
      setModels(modelArray);

      const currentModel = await configStorage.getCurrentModel();
      if (currentModel) {
        setSelectedModel(currentModel);
        const model = modelArray.find(m => m.id === currentModel);
        if (model) {
          setSelectedModelName(model.name);
        }
      }
    };

    fetchModels().catch(error => {
      console.error('Error fetching models:', error);
    });
  }, []);

  const handleModelClick = async (model: ModelItem, isCommandPressed: boolean) => {
    // Command+Enter 不保存设置
    if (!isCommandPressed) {
      await configStorage.setCurrentModel(model.id);
      setSelectedModel(model.id);
      setSelectedModelName(model.name);
    }
    onItemClick(model.name, isCommandPressed);
  };

  const renderModelItem = (model: ModelItem, index: number, active: boolean) => (
    <button
      className={`${
        active ? 'bg-black text-white' : 'text-gray-900'
      } group flex w-full items-center rounded-md px-2 py-2 text-sm focus:outline-none`}
      onClick={e => {
        e.preventDefault();
        handleModelClick(model, e.metaKey || e.ctrlKey);
        statusListener(false);
      }}>
      <span className="mr-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold border border-gray-300 rounded">
        {index}
      </span>
      <span className="whitespace-nowrap flex-1 flex justify-between items-center">
        <span>{model.shortName}</span>
        <span
          className={`ml-2 opacity-0 transition-all duration-100 ${active || 'group-hover:opacity-100'} ${
            active && 'opacity-100'
          }`}>
          [{model.provider}]
        </span>
      </span>
    </button>
  );

  return (
    <div ref={baseDropdownRef} className="relative">
      <BaseDropdown
        displayName={simplifyModelName(selectedModelName)}
        className={className}
        onItemClick={handleModelClick}
        statusListener={statusListener}
        initOpen={initOpen}
        items={models}
        selectedId={selectedModel}
        showShortcut={false}
        renderItem={renderModelItem}
        align="right"
      />
    </div>
  );
117|}
...

```

```src/chat/chat.ts
31|

export class ChatCoreContext implements ChatCoreInterface {
  model: ChatOpenAI;
  history: BaseMessage[] | HumanAskMessage[];
  _onDataListener: (_data: BaseMessage[]) => void;
  constructor() {
    this.history = [];
    this.history.length = 0;
    this.initSystemMessage();
    this.model = new ChatOpenAI({
      temperature: 0.2,
      topP: 0.95,
      modelName: 'free',
      openAIApiKey: 'sk-example', //必须得是非空字符串，否则会报错
      configuration: {
        baseURL: 'https://extapi.askman.dev/v1',
      },
    });
    this.init();
51|  }
...
...
33|export class ChatCoreContext implements ChatCoreInterface {

  ...
62|
  updateChatModel({ modelName, baseURL, apiKey }: { modelName: string; baseURL: string; apiKey: string }) {
    this.model = new ChatOpenAI({
      modelName: modelName,
      openAIApiKey: apiKey || '-', //必须得是非空字符串，否则会报错
      configuration: {
        baseURL: baseURL,
      },
    });
    return this;
  }
  /**
   * 根据模型名称创建对应的模型客户端
   * @param modelName 模型名称 {provider}/{model} 如：openai/gpt-3.5-turbo
   * @returns
   */
  async createModelClient(modelName: string) {
    // split by '/'
    const [provider, ...rest] = modelName.split('/');
    const model = rest.join('/');

    if (!provider || !model) {
      console.warn('Invalid model name, cant find provider or model.', modelName);
      return this;
    }
    const modelConfigs = await configStorage.getModelConfig();
    const modelConfig = modelConfigs.find(m => m.provider == provider);
    const chatInput: Partial<OpenAIChatInput> & { configuration?: ClientOptions } = {};
    if (modelConfig) {
      chatInput.temperature = modelConfig.config.temperature || 0.2;
      chatInput.topP = modelConfig.config.topP || 0.95;
      chatInput.frequencyPenalty = modelConfig.config.frequencyPenalty || 0;
      chatInput.presencePenalty = modelConfig.config.presencePenalty || 0;
      chatInput.openAIApiKey = modelConfig.config.api_key;
      chatInput.configuration = {
        baseURL: modelConfig.config.base_url,
      };
      modelConfig.config.models.some((m: { name: string; max_tokens: number }) => {
        if (m.name == model) {
          chatInput.modelName = m.name;
          return true;
        }
        return false;
      });
      this.model = new ChatOpenAI(chatInput);
    }
    return this;
109|  }
...
...
33|export class ChatCoreContext implements ChatCoreInterface {


  ...
169|

  /**
   * Asynchronously prompts the user with a specific tool, a list of quotes, and an optional user prompt.
   *
   * @param {ToolsPromptInterface} tool - the specific tool to prompt the user with
   * @param {QuoteContext[]} quotes - a list of quotes to prompt the user with
   * @param {null | string} userPrompt - an optional prompt for the user
   * @return {Promise<void>} a Promise that resolves when the user has responded
   */
  async askWithTool(
    framework: ToolsPromptInterface | null,
    pageContext: QuoteContext | null,
    quotes: QuoteContext[],
    userPrompt: null | string,
    options?: SendOptions,
  ): Promise<void> {
    // 1. 更新当前模型：使用临时模型或存储的模型
    const currentModel = options?.overrideModel || (await configStorage.getCurrentModel());
    await this.createModelClient(currentModel);

    // 2. 系统提示词：临时提示词优先于存储的提示词
    const systemPrompt = options?.overrideSystem || (await StorageManager.getSystemPrompt()).content;
    // Remove old system message if exists
    this.history = this.history.filter(msg => !(msg instanceof SystemInvisibleMessage));
    // Add new system message
    this.history.unshift(new SystemInvisibleMessage(systemPrompt));

    if (!userPrompt) {
      userPrompt = '';
    }

    const baseContext = {
      browser: {
        language: pageContext?.browserLanguage,
      },
      page: {
        url: pageContext?.pageUrl,
        title: pageContext?.pageTitle,
        content: pageContext?.pageContent,
        selection: pageContext?.selection,
      },
      chat: {
        language: pageContext?.browserLanguage,
        input: userPrompt,
      },
    };

    // 使用新的消息处理流程
    const prompt = this.processMessage(baseContext, framework, quotes);

    if (!prompt || prompt.trim() === '') {
      console.warn('[Askman] prompt is empty, skip sending');
      return;
    }

    this.history.push(new HumanMessage({ content: prompt }));
    if (this._onDataListener) {
      setTimeout(() => this._onDataListener(this.history));
    }
    return this.stream(this.history);
  }
  async stream(history: BaseMessage[]): Promise<void> {
    if (this._onDataListener == null) {
      console.warn('no this._onDataListener');
    }

    const pendingResponse = new AIMessage({ content: 'Thinking ...' });
    let hasResponse = false;
    setTimeout(() => {
      this.history.push(pendingResponse);
    }, 1);

    if (this._onDataListener) {
      setTimeout(() => this._onDataListener(this.history), 2);
    }

    let lastError = null;
    try {
      const stream = await this.model.stream(history);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
        const content = chunks.reduce((acc, cur) => acc + cur.content, '');
        // const name = chunk.name;
        if (content.trim() === '') continue;

        pendingResponse.content = content;
        // pendingResponse.name = name || 'ai';
        hasResponse = true;
        if (this._onDataListener) {
          setTimeout(() => this._onDataListener(this.history));
        }
      }
    } catch (error) {
      lastError = error;
    }

    if (!hasResponse) {
      pendingResponse.content = '(Nothing to Show)';
      if (lastError) {
        pendingResponse.content += '\n' + lastError.message;
      }
      if (lastError) {
        pendingResponse.content += '\n' + lastError.message;
      }
      if (this._onDataListener) {
        setTimeout(() => this._onDataListener(this.history));
      }
    }
279|  }
...

```

```src/utils/StorageManager.ts
12|

export interface ModelInterface {
  id: string;
  name: string;
17|}
...
...
57|export const StorageManager = {
58|  save: (key: string, value: string | number | boolean | object) => {


  ...
159|

  getSystemPrompt: async (): Promise<SystemPromptContent> => {
    try {
      const preferences = await StorageManager.getUserPreferences();
      const userChatPresets = await StorageManager.getUserChatPresets();
      const currentPreset = await StorageManager.getCurrentSystemPreset();

      // Merge system and user configs, with user config taking precedence
      const mergedConfig = {
        ...chatPresets,
        ...userChatPresets,
      };

      // 如果有选中的预设且存在，则使用选中的预设
      if (currentPreset && mergedConfig[currentPreset]?.system) {
        const template = Handlebars.compileAST(mergedConfig[currentPreset].system);
        const systemContent = template({
          USER_LANGUAGE: preferences.USER_LANGUAGE,
        });

        return {
          content: systemContent,
          name: currentPreset,
        };
      }

      // 如果没有选中的预设或预设不存在，使用默认的 system-init
      const template = Handlebars.compileAST(mergedConfig['system-init'].system);
      const systemContent = template({
        USER_LANGUAGE: preferences.USER_LANGUAGE,
      });

      return {
        content: systemContent,
        name: 'system-init',
      };
    } catch (e) {
      logger.error('Error loading system prompt:', e);
      throw e;
    }
  },

  getSystemPresets: async (): Promise<SystemPresetInterface[]> => {
    try {
      const userChatPresets = await StorageManager.getUserChatPresets();

      // Merge system and user configs, with user config taking precedence
      const mergedConfig = {
        ...chatPresets,
        ...userChatPresets,
      };

      const systemPresets: SystemPresetInterface[] = [];
      for (const k in mergedConfig) {
        if (k.startsWith('system-')) {
          const preset = mergedConfig[k] as ChatPresetContext;
          if (preset.system) {
            systemPresets.push({
              id: k,
              name: k,
              hbs: preset.system,
              template: Handlebars.compileAST(preset.system),
            });
          }
        }
      }
      return systemPresets;
    } catch (e) {
      logger.error('Error loading system presets:', e);
      return [];
    }
  },

  getCurrentSystemPreset: async (): Promise<string | null> => {
    return StorageManager.get(CURRENT_SYSTEM_PRESET_KEY);
  },

  setCurrentSystemPreset: async (presetName: string): Promise<void> => {
    return StorageManager.save(CURRENT_SYSTEM_PRESET_KEY, presetName);
  },

  // 获取当前工具
  getCurrentTool: async () => {
    return await StorageManager.get('current-tool');
  },

  // 设置当前工具
  setCurrentTool: async (toolName: string) => {
    await StorageManager.save('current-tool', toolName);
  },

  // 获取模型配置
  getModelConfig: async () => {
    const systemConfigPath = '/assets/conf/models.toml';
    const systemConfigResponse = await fetch(chrome.runtime.getURL(systemConfigPath));
    const systemConfigStr = await systemConfigResponse.text();
    const userConfigObj = await StorageManager.getUserModels();
    const systemConfigObj = TOML.parse(systemConfigStr);
    const mergedConfigObj = {
      ...systemConfigObj,
      ...(Array.isArray(userConfigObj) ? {} : userConfigObj), // 如果 userConfigObj 是数组，则不合并
    } as Record<string, TomlModelConfig['config']>;
    return Object.entries(mergedConfigObj).map(([provider, config]) => ({
      provider,
      config,
    })) as TomlModelConfig[];
  },
267|};
...

```

```src/components/ask-panel.tsx
...
44|function AskPanel(props: AskPanelProps) {
45|  const { visible, quotes, onHide, ...rest } = props;

  ...
149|
  const updateModelDropdownStatus = (status: boolean) => {
    setIsModelDropdownOpen(status);
  };
  const updateQuoteDropdownStatus = (status: boolean) => {
    setIsQuoteDropdownOpen(status);
  };
  const updateSystemPromptDropdownStatus = (status: boolean) => {
    setIsSystemPromptDropdownOpen(status);
  };

  useEffect(() => {
    // 获取当前选中的工具
    const fetchCurrentTool = async () => {
      try {
        const currentToolId = await StorageManager.getCurrentTool();
        if (currentToolId) {
          const userToolSettings = await StorageManager.getUserTools();
          const allToolsList = [
            ...tools,
            ...Object.values(userToolSettings).map(tool => ({
              id: tool.name,
              name: tool.name,
              hbs: tool.hbs,
              template: Handlebars.compileAST(tool.hbs),
            })),
          ];
          const tool = allToolsList.find(t => t.id === currentToolId);
          if (tool) {
            setUserTools(tool);
          }
        }
      } catch (error) {
        console.error('Error fetching current tool:', error);
      }
    };

    QuoteAgent.getQuoteByDocument(window.location.href, document).then(quoteContext => {
      updatePageContext(quoteContext);
    });
    fetchCurrentTool();
    // console.log('chatContext.history = ' + JSON.stringify(chatContext.history));
    function rerenderHistory() {
      setHistory(
        chatContext.history
          .filter(
            message =>
              !(
                message instanceof HumanInvisibleMessage ||
                message instanceof AIInvisibleMessage ||
                message instanceof SystemInvisibleMessage
              ),
          )
          .map((message, idx) => {
            let role = 'assistant';
            if (message instanceof HumanMessage) {
              role = 'user';
            }
            if (message instanceof HumanAskMessage) {
              return {
                type: 'text',
                id: `history-${idx}`,
                text: message.rendered,
                role: role,
                name: 'HumanAskMessage',
              };
            } else if (typeof message.content == 'string') {
              return { type: 'text', id: `history-${idx}`, text: message.content, role: role, name: 'AIMessage' };
            } else if (message.content instanceof Array) {
              return {
                type: 'text',
                id: `history-${idx}`,
                role: role,
                text: message.content.reduce((acc, cur) => {
                  if (cur.type == 'text') {
                    return acc + '\n' + cur.text;
                  } else if (cur.type == 'image_url') {
                    return acc + '\n' + cur.image_url;
                  } else {
                    return acc + '\n<unknown>';
                  }
                }, ''),
              };
            }
          }),
      );
    }

    // console.log('注册消息回调');
    chatContext.setOnDataListener(() => {
      // console.log(data);
      rerenderHistory();
    });
    rerenderHistory();

    askPanelVisible &&
      setTimeout(() => {
        // console.log('获取焦点');
        inputRef.current.focus();
248|      }, 200);
...
...
44|function AskPanel(props: AskPanelProps) {
44|function AskPanel(props: AskPanelProps) {
45|  const { visible, quotes, onHide, ...rest } = props;


              ...
670|

              <QuoteDropdown
                initOpen={isQuoteDropdownOpen}
                statusListener={updateQuoteDropdownStatus}
                className="absolute"
                style={{
                  left: `${dropdownPosition.left}px`,
                  top: `${dropdownPosition.top}px`,
                }}
                onItemClick={item => {
                  addQuote(item);
                }}
              />
            </div>
            <div className="flex">
              <SystemPromptDropdown
                className="relative inline-block text-left"
                statusListener={updateSystemPromptDropdownStatus}
                initOpen={isSystemPromptDropdownOpen}
                onItemClick={(preset, withCommand) => {
                  if (withCommand) {
                    onSend(undefined, preset.hbs); // 按了 Command 键直接发送，使用 hbs 作为临时系统提示词
                  }
                }}
              />
              <ModelDropdown
                initOpen={isModelDropdownOpen}
                className="relative"
                onItemClick={(model, withCommand) => {
                  if (withCommand) {
                    onSend(undefined, undefined, model); // 直接传递 model，不再包装成对象
                  }
                }}
                statusListener={updateModelDropdownStatus}
              />
              <div className="grow"></div>
              <div className="w-px h-6 bg-gray-200 mx-2 my-auto"></div>
              <ToolDropdown
                initOpen={isToolDropdownOpen}
                statusListener={updateToolDropdownStatus}
                className="inline-block relative"
                onItemClick={(_item, _withCommand) => {
                  setUserTools(_item);
                  onSend(_item); // 直接发送，不需要修改按钮文字
                }}
                buttonDisplay="➔"
              />
            </div>
          </div>
720|        </div>
...

```

```test-utils/llm.ts
1|import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QuoteContext } from '../src/agents/quote';

const model = new ChatOpenAI({
  temperature: 0.2,
  topP: 0.2,
  modelName: 'glm-3-turbo',
  openAIApiKey: 'sk-1234567890',
  configuration: {
    baseURL: 'https://dev.bricks.cool/api',
  },
});

export const myObject = {
  test: async (userPrompt: string) => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'human',
        `你是 问那个人，你需要帮助用户解决问题.你需要遵循以下指导:
      1. 使用中文回答
      2. 用户的 Quote 需要你关注，但并不要求一定用到
      3. 用户的问题回跟在 UserPrompt 后面`,
      ],
      ['ai', '遵命，无论如何我都会帮助你'],
      ['human', '{topic}'],
    ]);
    const outputParser = new StringOutputParser();

    const chain = prompt.pipe(model).pipe(outputParser);
    const response = await chain.invoke({
      topic: userPrompt,
    });
    console.log(`> ${userPrompt}

< ${response}
---`);
  },
  askWithQuotes: async (quotes: QuoteContext[], userPrompt: null | string) => {
    let prompt = '';
    quotes.forEach(quote => {
      if (quote.pageTitle && quote.pageUrl && quote.selection) {
        prompt += `* \`${quote.selection}\` from [${quote.pageTitle}](${quote.pageUrl})\n`;
      } else {
        prompt += `* ${quote.selection}\n`;
      }
    });
    if (userPrompt) {
      prompt += 'User Prompt:\n' + userPrompt;
    }

    myObject.test(prompt);
  },
55|};
...

```

```src/shared/storages/configStorage.ts
1|import { BaseStorage, createStorage, StorageType } from '@src/shared/storages/base';
import { StorageManager } from '@src/utils/StorageManager';

interface Config {
  apiKey: string;
  model: string;
  temperature: number;
  selectedModel?: string;
}

export interface TomlModelConfig {
  provider: string;
  config: {
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    api_key?: string;
    base_url?: string;
    models: Array<{
      name: string;
      id?: string;
      max_tokens: number;
    }>;
  };
}

const defaultConfig: Config = {
  apiKey: '',
  model: 'free', // 'openai/gpt-4o'
  temperature: 0.2,
};

type ConfigStorage = BaseStorage<Config> & {
  setApiKey: (_apiKey: string) => Promise<void>;
  setModel: (_model: string) => Promise<void>;
  setTemperature: (_temperature: number) => Promise<void>;
  getModelConfig: () => Promise<TomlModelConfig[]>;
  getCurrentModel: () => Promise<string | null>;
  setCurrentModel: (_model: string) => Promise<void>;
};

const storage = createStorage<Config>('config-storage-key', defaultConfig, {
  storageType: StorageType.Local,
  liveUpdate: true,
});

const configStorage: ConfigStorage = {
  ...storage,
  setApiKey: async (apiKey: string) => {
    await storage.set(prevConfig => ({ ...prevConfig, apiKey }));
  },
  setModel: async (model: string) => {
    await storage.set(prevConfig => ({ ...prevConfig, model }));
  },
  setTemperature: async (temperature: number) => {
    await storage.set(prevConfig => ({ ...prevConfig, temperature }));
  },
  getModelConfig: async () => {
    const modelConfig = await StorageManager.getModelConfig();
    return modelConfig;
  },
  getCurrentModel: async () => {
    const config = await storage.get();
    return config.model || null;
  },
  setCurrentModel: async (model: string) => {
    await storage.set(prevConfig => ({ ...prevConfig, model }));
  },
};

72|export default configStorage;
...

```

```src/global.d.ts
1|declare module 'virtual:reload-on-update-in-background-script' {
  export const reloadOnUpdate: (_watchPath: string) => void;
  export default reloadOnUpdate;
}

declare module 'virtual:reload-on-update-in-view' {
  const refreshOnUpdate: (_watchPath: string) => void;
  export default refreshOnUpdate;
}

declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.SFC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: string;
  export default content;
}
declare module '*/tools.toml' {
  const content: { name: string; hbs: string }[];
  export default content;
}

declare module '*/chat-presets.toml' {
  const content: { human: string; ai: string }[];
  export default content;
}

declare module '*/models.toml' {
  const content: {
    [provider: string]: {
      [key: string]: string | number | { name: string; max_tokens: number }[];
    };
  };
  export default content;
}

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor';
53|}
...

```

