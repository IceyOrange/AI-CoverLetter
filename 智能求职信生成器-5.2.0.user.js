// ==UserScript==
// @name         智能求职信生成器
// @namespace    http://tampermonkey.net/
// @version      5.2.0
// @description  带可视化面板的智能求职信生成系统
// @author       IceyOrange
// @match        https://www.zhipin.com/*
// @match        https://www.liepin.com/*
// @match        https://jobs.51job.com/*
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
            maxHeight: 300// 最大展开高度
        },
        drag: {
            minX: 20,// 窗口离屏最小保留距离
            dragHandle: '.smart-header'
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
            font-size: 14px;
            color: #212529;
            font-weight: 600;
        }
        .smart-body {
            padding: 16px;
            max-height: 60vh;
            overflow-y: auto;
        }
        .smart-body::-webkit-scrollbar {
            width: 8px; /* 垂直滚动条宽度 */
            height: 8px; /* 水平滚动条高度 */
        }
        .jd-preview {
            font-size: 12px;
            color: #495057;
            white-space: pre-wrap;
            line-height: 1.6;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            max-height: 150px;
            overflow-y: auto;
        }
        .jd-preview::-webkit-scrollbar {
            width: 8px; /* 垂直滚动条宽度 */
            height: 8px; /* 水平滚动条高度 */
        }
        .generate-btn {
            width: 100%;
            padding: 12px;
            background: #268dff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            position: relative;
            padding: 6px 16px;
            background: linear-gradient(145deg, #268dff, #1a73e8);
            color: white !important;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(39, 141, 255, 0.2);
            font-size: 13px;
        }
        .copy-btn::before {
            content: "⎘";
            margin-right: 6px;
            filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));
        }

        .copy-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(39, 141, 255, 0.3);
        }

        .copy-btn.copied {
            background: linear-gradient(145deg, #00c853, #009624);
            box-shadow: 0 2px 8px rgba(0, 200, 83, 0.2);
        }

        .copy-btn.copied::before {
            content: "✓";
        }

        /* 优化结果区域 */
        .result-box {
            position: relative;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin-top: 12px;
            max-height: 150px;
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

    // 网站选择器映射表
    const SELECTOR_MAP = {
        'www.zhipin.com': { // BOSS直聘
            jd: 'div.job-detail-body p.desc',
            //title: 'h1.job-title',
            //company: 'div.company-info a.name'
        },
        'www.liepin.com': { // 猎聘
            jd: 'section.job-intro-container dd',
        },
        'jobs.51job.com': {
            jd: 'div.bmsg.job_msg.inbox',
        }
        // 可继续扩展其他网站
    };


    const initDragSystem = (container) => {
        let isDragging = false;
        let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
        const dragHandle = container.querySelector(CONFIG.drag.dragHandle);

        const clampPosition = (value, min, max) =>
        Math.max(min, Math.min(value, window.innerWidth - max));
        const onMouseDown = (e) => {
            isDragging = true;
            const rect = container.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            container.style.transition = 'none'; // 拖拽时禁用动画
            document.body.style.userSelect = 'none'; // 防止文字选中
        };
        const onMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = clampPosition(
                initialLeft + deltaX,
                CONFIG.drag.minX,
                container.offsetWidth
            );

            const newTop = clampPosition(
                initialTop + deltaY,
                CONFIG.drag.minX,
                container.offsetHeight
            );
            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
        };
        const onMouseUp = () => {
            isDragging = false;
            container.style.transition = '';
            document.body.style.userSelect = '';
        };
        dragHandle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleCopy = (content) => {
        const typeMap = {
            success: { text: '✓ 已复制', style: 'copied' },
            error: { text: '! 失败', style: 'error' }
        };
        return () => {
            const copyAction = () => {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = content.replace(/(\n\s*){2,}/g, '\n'); // 清除多余空行
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();

                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);

                    return success ? 'success' : 'error';
                } catch (e) {
                    return 'error';
                }
            };
            const status = copyAction();
            const { text, style } = typeMap[status];
            const btn = event.currentTarget;

            // 添加状态反馈
            btn.classList.add(style);
            btn.disabled = true;

            setTimeout(() => {
                btn.classList.remove(style);
                btn.disabled = false;
            }, 2000);
        };
    };

    const getSelector = (key) => {
        const domain = window.location.hostname;
        const selectors = SELECTOR_MAP[domain];

        if (!selectors) {
            throw new Error(`未找到 ${domain} 的选择器配置`);
        }

        const selector = selectors[key];
        if (!selector) {
            throw new Error(`未找到 ${domain} 的 ${key} 选择器`);
        }

        return selector;
    };

    // 智能JD扫描器 ==============================
    const initJDTracker = () => {
        const scanJD = () => {

            const jdElement = document.querySelector(getSelector('jd'));
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
            <h3 class="smart-title">📮 智能求职信生成器</h3>
            <svg class="fold-indicator" width="24" height="24" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="smart-body" style="max-height:${CONFIG.uiAnimation.maxHeight}px;transition:all ${CONFIG.uiAnimation.foldSpeed}s ease-out">
            <div class="jd-section">
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
        // 清空已有内容
        const resultArea = container.querySelector('.result-area');
        resultArea.innerHTML = '';
        // 创建富文本展示模块
        const resultBox = document.createElement('div');
        resultBox.className = 'result-box';
        // 插入带格式的内容（保留换行）
        const resultContent = document.createElement('div');
        resultContent.className = 'result-content';
        resultContent.innerHTML = (data?.result || '')
            .replace(/\\n/g, '<br>')
            .replace(/```html/g, '')
            .replace(/```/g, '');
        resultBox.appendChild(resultContent);
        // 添加悬浮工具条
        const toolBar = document.createElement('div');
        toolBar.className = 'result-actions';
        // 创建现代化复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = ' 复制内容';
        // 绑定优化后的复制处理
        copyBtn.addEventListener('click', () => {
            const typeMap = {
                success: { text: '✓ 已复制', style: 'copied' },
                error: { text: '! 失败', style: 'error' }
            };
            const copyAction = () => {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = resultContent.innerText.replace(/(\n\s*){2,}/g, '\n'); // 清除多余空行
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    return success ? 'success' : 'error';
                } catch (e) {
                    return 'error';
                }
            };
            const status = copyAction();
            const { text, style } = typeMap[status];
            // 添加状态反馈
            copyBtn.classList.add(style);
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.classList.remove(style);
                copyBtn.disabled = false;
            }, 2000);
        });
        // 组装组件
        toolBar.appendChild(copyBtn);
        resultBox.appendChild(toolBar);
        resultArea.appendChild(resultBox);
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
        if (!document.querySelector(getSelector('jd'))) {
            setTimeout(init, CONFIG.scanInterval);
            return;
        }

        console.log('开始初始化');
        const uiContainer = createAssistantUI();
        initDragSystem(uiContainer);
        initJDTracker();

        // 绑定生成事件
        uiContainer.querySelector('.generate-btn').addEventListener('click', () => handleGenerate(uiContainer));
    };

    window.addEventListener('load', init);
    document.addEventListener('DOMContentLoaded', init);
})();
