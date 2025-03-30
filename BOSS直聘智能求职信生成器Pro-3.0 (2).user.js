// ==UserScript==
// @name         BOSS直聘智能求职信生成器Pro
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  带可视化面板的智能求职信生成系统
// @author       Your Name
// @match        https://www.zhipin.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 配置中心 =================================
    const CONFIG = {
        apiEndpoint: "http://localhost:5000/generate",
        scanInterval: 500,
        uiPosition: { right: '30px', top: '100px' },
        uiAnimation: {
            foldSpeed: 0.3,// 折叠动画速度(s)
            maxHeight: 600// 最大展开高度
        }
    };

    // UI样式表 ================================
    GM_addStyle(`
        .smart-assistant {
            position: fixed;
            right: ${CONFIG.uiPosition.right};
            top: ${CONFIG.uiPosition.top};
            width: 360px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: transform 0.3s ease;
        }
        .smart-header {
            padding: 16px;
            background: #f8f9fa;
            border-radius: 12px 12px 0 0;
            border-bottom: 1px solid #e9ecef;
        }
        .smart-title {
            margin: 0;
            font-size: 18px;
            color: #212529;
            font-weight: 600;
        }
        .smart-body {
            padding: 16px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .jd-preview {
            font-size: 14px;
            color: #495057;
            white-space: pre-wrap;
            line-height: 1.6;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            max-height: 200px;
            overflow-y: auto;
        }
        .generate-btn {
            width: 100%;
            padding: 12px;
            background: #268dff;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        .generate-btn:hover {
            background: #1a73e8;
        }
        .generate-btn:disabled {
            background: #94d3ff;
            cursor: not-allowed;
        }
        .result-area {
            display: none;
            font-size: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
            padding: 12px;
            border-radius: 8px;
            background: #f8f9fa;
        }
        .loading-indicator {
            display: none;
            text-align: center;
            padding: 12px;
            color: #6c757d;
        }
        /* 新增折叠动效 */
        .smart-assistant.collapsed .smart-body {
            max-height: 0 !important;
            opacity: 0;
            padding: 0;
        }
        /* 折叠箭头标识 */
        .fold-indicator {
            position: absolute;
            right: 16px;
            top: 12px;
            transition: transform 0.3s;
        }
        .collapsed .fold-indicator {
            transform: rotate(180deg);
        }
        /* 新增复制按钮样式 */
        .copy-toolbar {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .copy-btn {
            padding: 6px 12px;
            background: #e9ecef;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .copy-btn:hover {
            background: #dee2e6;
        }
        /* 优化结果区域 */
        .result-box {
            position: relative;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin-top: 12px;
        }
        .result-actions {
            position: absolute;
            right: 8px;
            top: 8px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .result-box:hover .result-actions {
            opacity: 1;
        }
    `);

    let currentJD = null;
    let isProcessing = false;

    // 智能JD扫描器 ==============================
    const initJDTracker = () => {
        const scanJD = () => {
            const jdElement = document.querySelector('div.job-detail-body p.desc');
            if (jdElement) {
                const newJD = jdElement.innerText
                    .replace(/\s+/g, ' ')
                    .trim();

                if (newJD !== currentJD) {
                    currentJD = newJD;
                    updateUI();
                }
            }
        };

        // 双保险检测机制
        new MutationObserver(scanJD).observe(document.body, {
            childList: true,
            subtree: true
        });
        setInterval(scanJD, CONFIG.scanInterval);
    };

    // 智能UI控制器 ==============================
    const createAssistantUI = () => {
        const container = document.createElement('div');
        container.className = 'smart-assistant';
        container.innerHTML = `
        <div class="smart-header">
            <h3 class="smart-title">📮 BOSS求职信Pro</h3>
            <svg class="fold-indicator" width="24" height="24" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="smart-body" style="max-height:${CONFIG.uiAnimation.maxHeight}px;transition:all ${CONFIG.uiAnimation.foldSpeed}s ease-out">
            <div class="jd-section">
                <div class="jd-title">捕获JD</div>
                <div class="jd-preview">${currentJD || '正在扫描岗位描述...'}</div>
            </div>
            <button class="generate-btn">生成定制求职信</button>
            <div class="loading-indicator">⏳ 智能生成中，请稍候...</div>
            <div class="result-area"></div>
        </div>
    `;
        // 添加折叠功能
        container.querySelector('.smart-header').addEventListener('click', () => {
            container.classList.toggle('collapsed');
        });

        document.body.appendChild(container);
        return container;
    };



    // 动态UI更新器 ==============================
    const updateUI = () => {
        const jdPreview = document.querySelector('.jd-preview');
        if (jdPreview) {
            jdPreview.textContent = currentJD || '未检测到有效岗位描述';
        }
    };

    // 增强版生成引擎 =============================
    const handleGenerate = async (uiContainer) => {
        if (!currentJD || isProcessing) return;

        try {
            isProcessing = true;
            toggleLoading(true);

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: CONFIG.apiEndpoint,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ jd: currentJD }),
                    timeout: 150000,
                    onload: (res) => {
                        console.log("API 原始响应:", res);

                        try {
                            const responseData = JSON.parse(res.responseText);
                            console.log("解析后的 JSON:", responseData);

                            if (responseData.result) {
                                resolve(responseData);
                            } else {
                                reject(new Error(`API 响应中找不到 result 字段: ${JSON.stringify(responseData)}`));
                            }
                        } catch (e) {
                            reject(new Error(`JSON 解析失败: ${res.responseText}`));
                        }
                    },
                    onerror: (err) => reject(new Error(`网络错误: ${err}`)),
                    ontimeout: () => reject(new Error('请求超时'))
                });
            });
            showResult(uiContainer, response);
        } catch (error) {
            console.log(error);
            showError(error);
        } finally {
            isProcessing = false;
            toggleLoading(false);
        }
    };

    // UI状态控制器 ============================== 复制功能仍待完善
    const toggleLoading = (isLoading) => {
        const btn = document.querySelector('.generate-btn');
        const loader = document.querySelector('.loading-indicator');
        if (btn) btn.disabled = isLoading;
        if (loader) loader.style.display = isLoading ? 'block' : 'none';
    };

    const showResult = (container, data) => {
        const resultArea = container.querySelector('.result-area');
        // 防御性访问嵌套属性
        const content = data?.result || data?.response?.result;

        if (!content) {
            throw new Error('无效响应结构');
        }

        resultArea.innerHTML = '';
        // 创建富文本展示模块
        const resultBox = document.createElement('div');
        resultBox.className = 'result-box';

        // 插入带格式的内容（保留换行）
        resultBox.innerHTML = (content || '')
            .replace(/\\n/g, '<br>')
            .replace(/```html/g, '')
            .replace(/```/g, '');
        // 添加悬浮工具条
        const toolBar = document.createElement('div');
        toolBar.className = 'result-actions';
        toolBar.innerHTML = `
            <button class="copy-btn" title="复制内容">⎘ 复制</button>
        `;
        // 绑定复制功能
        toolBar.querySelector('.copy-btn').addEventListener('click', () => {
            const tempEl = document.createElement('textarea');
            tempEl.value = resultBox.innerText;
            document.body.appendChild(tempEl);
            tempEl.select();
            document.execCommand('copy');
            document.body.removeChild(tempEl);

            // 视觉反馈
            const btn = toolBar.querySelector('.copy-btn');
            btn.textContent = '✓ 已复制';
        });
        // 组装组件
        resultBox.prepend(toolBar);
        resultArea.append(resultBox);
        resultArea.style.display = 'block';
    };

    const showError = (error) => {
        const resultArea = document.querySelector('.result-area');
        resultArea.textContent = `请求失败: ${error.statusText || '服务不可用'}`;
        resultArea.style.color = '#dc3545';
        resultArea.style.display = 'block';
    };

    // 初始化流程 ================================
    const init = () => {
        if (!document.querySelector('div.job-detail-body')) {
            setTimeout(init, CONFIG.scanInterval);
            return;
        }

        const uiContainer = createAssistantUI();
        initJDTracker();

        // 绑定生成事件
        uiContainer.querySelector('.generate-btn').addEventListener('click', () => handleGenerate(uiContainer));
    };

    window.addEventListener('load', init);
    document.addEventListener('DOMContentLoaded', init);
})();
