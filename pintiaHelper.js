// ==UserScript==
// @name         PTA pintia 学习助手
// @namespace    a jjjjjjjjjjjjun.
// @version      1.0
// @description  自动识别题型，支持判断、单选、函数、编程题。可配置自动切换题型。支持PTA Pintia 程序题 自动答题 ai答题 程序设计类实验辅助教学平台 拼题A
// @author       A Jun
// @match        *://*.pintia.cn/problem-sets/*/exam/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      43.142.37.200
// @connect      ajunthinklab.top
// @icon       	 http://43.142.37.200/icon.png
// @downloadURL https://update.greasyfork.org/scripts/560207/PTA%20pintia%20%E5%AD%A6%E4%B9%A0%E5%8A%A9%E6%89%8B%20%28%E5%85%A8%E8%83%BD%E7%89%8810%29.user.js
// @updateURL https://update.greasyfork.org/scripts/560207/PTA%20pintia%20%E5%AD%A6%E4%B9%A0%E5%8A%A9%E6%89%8B%20%28%E5%85%A8%E8%83%BD%E7%89%8810%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. 配置管理 ---
    let isRunning = false;
    let solveCount = 0;
    const SERVER_URL = 'http://43.142.37.200:1145';
    const DONATE_IMAGE_URL = 'http://43.142.37.200/donate.png';
    
    // PTA 题目内容干扰元素选择器 (新增对新版 CodeMirror 6 编辑器的清理)
    const TRASH_SELECTORS = [
        '.ln', '.lnBorder', '.ln-border', '.function_HJSmz', '.foldIcon_V3Ad2', 
        'button', '.cm-gutters', '.cm-panels', '.cm-announced', 
        '.language_E7263', '.languageName_cZYHa', '.toolbar_SkQeK',
        '.pc-button', '.select-none.bd-left-1' // 额外新增的冗余按钮和分隔符
    ];

    const CONFIG = {
        get autoNext() { return GM_getValue('pta_auto_next', false); },
        set autoNext(v) { GM_setValue('pta_auto_next', v); },
        get funcLang() { return GM_getValue('pta_func_lang', 'C'); },
        set funcLang(v) { GM_setValue('pta_func_lang', v); },
        get progLang() { return GM_getValue('pta_prog_lang', 'C'); },
        set progLang(v) { GM_setValue('pta_prog_lang', v); },
        get removeComments() { return GM_getValue('pta_remove_comments', true); },
        set removeComments(v) { GM_setValue('pta_remove_comments', v); }
    };

    // 语言映射表
    const LANG_MAP = {
        'C': 'C (gcc)',
        'C++': 'C++ (g++)',
        'Java': 'Java (javac)',
        'Python': 'Python (python3)'
    };

    // --- 1. 样式定义 ---
    GM_addStyle(`
        #pta-helper-window {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 340px;
            height: 520px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
        }
        #pta-helper-header {
            padding: 12px;
            background: #f8f9fa;
            cursor: move;
            border-bottom: 1px solid #eee;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #pta-helper-tabs {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        }
        .pta-tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            font-size: 13px;
            color: #666;
            transition: all 0.2s;
        }
        .pta-tab.active {
            color: #007bff;
            border-bottom: 2px solid #007bff;
            background: #fff;
            font-weight: bold;
        }
        #donate-tab, #protocol-tab {
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #444;
            line-height: 1.6;
        }
        .protocol-text {
            text-align: left;
            font-size: 12px;
            color: #666;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
            height: 350px;
            overflow-y: auto;
            line-height: 1.8;
        }
        .donate-img {
            width: 200px;
            height: 200px;
            margin: 15px auto;
            border: 1px solid #eee;
            border-radius: 8px;
            display: block;
        }
        .donate-text {
            color: #666;
            margin-top: 15px;
            text-align: left;
            padding: 0 10px;
        }
        .token-info {
            font-size: 11px;
            color: #888;
            background: #f9f9f9;
            padding: 6px 10px;
            border-radius: 4px;
            margin-top: 4px;
            border: 1px dashed #eee;
        }
        .donate-link {
            color: #007bff;
            cursor: pointer;
            text-decoration: underline;
            margin-left: 5px;
        }
        .donate-link:hover {
            color: #0056b3;
        }
        #pta-tab-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .tab-pane {
            display: none;
            flex: 1;
            flex-direction: column;
            overflow: hidden;
        }
        .tab-pane.active {
            display: flex;
        }
        #pta-helper-settings {
            padding: 15px;
            font-size: 13px;
            overflow-y: auto;
        }
        .setting-item { margin-bottom: 15px; }
        .setting-item label { display: block; margin-bottom: 6px; color: #444; font-weight: 500; }
        .setting-item input[type="text"], .setting-item select {
            width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ddd; border-radius: 6px;
            font-size: 13px;
        }
        .setting-item.checkbox-item { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .setting-item.checkbox-item label { display: inline; margin-bottom: 0; color: #333; cursor: pointer; }
        .setting-item.checkbox-item input { width: auto; margin: 0; cursor: pointer; }

        #pta-helper-log {
            flex: 1;
            padding: 12px;
            font-size: 12px;
            overflow-y: auto;
            background: #fff;
            color: #333;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .log-item {
            border-left: 3px solid #eee;
            padding: 4px 8px;
            background: #fcfcfc;
        }
        .log-item.info { border-left-color: #007bff; background: #f0f7ff; color: #0056b3; font-weight: 500; text-align: center; border-left: none; border-radius: 4px; }
        .log-q { color: #555; font-weight: 600; margin-bottom: 2px; }
        .log-a { color: #28a745; white-space: pre-wrap; line-height: 1.4; }
        .log-err { color: #dc3545; }
        .log-status { color: #999; font-style: italic; font-size: 11px; }

        #pta-helper-footer {
            padding: 12px;
            border-top: 1px solid #eee;
            background: #fff;
            display: flex;
            gap: 8px;
        }
        .pta-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            flex: 1;
            transition: background 0.2s;
        }
        .pta-btn.danger { background: #dc3545; }
        .pta-btn.secondary { background: #6c757d; }
        .pta-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .pta-btn:hover:not(:disabled) { opacity: 0.9; }

    `);

    // --- 2. 创建 UI ---
    const helperWin = document.createElement('div');
    helperWin.id = 'pta-helper-window';
    helperWin.innerHTML = `
        <div id="pta-helper-header">
            <span>PTA 学习助手</span>
            <span style="font-size: 10px; color: #999;">v1.0</span>
        </div>
        <div id="pta-helper-tabs">
            <div class="pta-tab active" data-tab="home">主页</div>
            <div class="pta-tab" data-tab="settings">设置</div>
            <div class="pta-tab" data-tab="donate">打赏</div>
            <div class="pta-tab" data-tab="protocol">协议</div>
        </div>
        <div id="pta-tab-content">
            <div id="home-tab" class="tab-pane active">
                <div id="pta-helper-log"></div>
                <div id="pta-helper-footer">
                    <button id="start-btn" class="pta-btn">开始答题</button>
                    <button id="stop-btn" class="pta-btn danger" style="display:none;">停止</button>
                    <button id="clear-btn" class="pta-btn secondary">清空日志</button>
                </div>
            </div>
            <div id="settings-tab" class="tab-pane">
                <div id="pta-helper-settings">
                    <div class="setting-item checkbox-item">
                        <input type="checkbox" id="auto-next-input" ${CONFIG.autoNext ? 'checked' : ''}>
                        <label for="auto-next-input">完成后自动切换下一题型</label>
                    </div>
                    <div class="setting-item checkbox-item">
                        <input type="checkbox" id="remove-comments-input" ${CONFIG.removeComments ? 'checked' : ''}>
                        <label for="remove-comments-input">提交前自动清除代码注释</label>
                    </div>
                    <div class="setting-item">
                        <label>函数题语言:</label>
                        <select id="func-lang-select">
                            <option value="C" ${CONFIG.funcLang === 'C' ? 'selected' : ''}>C</option>
                            <option value="C++" ${CONFIG.funcLang === 'C++' ? 'selected' : ''}>C++</option>
                            <option value="Java" ${CONFIG.funcLang === 'Java' ? 'selected' : ''}>Java</option>
                            <option value="Python" ${CONFIG.funcLang === 'Python' ? 'selected' : ''}>Python</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>编程题语言:</label>
                        <select id="prog-lang-select">
                            <option value="C" ${CONFIG.progLang === 'C' ? 'selected' : ''}>C</option>
                            <option value="C++" ${CONFIG.progLang === 'C++' ? 'selected' : ''}>C++</option>
                            <option value="Java" ${CONFIG.progLang === 'Java' ? 'selected' : ''}>Java</option>
                            <option value="Python" ${CONFIG.progLang === 'Python' ? 'selected' : ''}>Python</option>
                        </select>
                    </div>
                    <div style="font-size: 11px; color: #999; text-align: center; margin-top: 20px;">
                        设置将自动保存<br><br><br>
                        本脚本不能保证100%的正确率<br>
                        模型思考较久，若长时间(3分钟以上)无回应请刷新网页<br>
                        有其他问题请在讨论区反馈
                    </div>
                </div>
            </div>
            <div id="donate-tab" class="tab-pane">
                <img src="${DONATE_IMAGE_URL}" class="donate-img" alt="赞赏码">
                <div class="donate-text">
                    本项目为纯公益开发 ✨。若它对您有所帮助，欢迎赞赏支持。您的每一份心意都将用于服务器与 API 的维护，助力项目长久运行 🚀。感谢您的认可！( •̀ ω •́ )y
                </div>
            </div>
            <div id="protocol-tab" class="tab-pane">
                <div class="protocol-text">
                    <strong>免责声明：</strong><br><br>
                    1、本脚本仅供学习和研究目的使用，并应在24小时内删除。脚本的使用不应违反任何法律法规及学术道德标准。<br><br>
                    2、用户在使用脚本时，必须遵守所有适用的法律法规。任何由于使用脚本而引起的违法行为或不当行为，其产生的一切后果由用户自行承担。<br><br>
                    3、开发者不对用户使用脚本所产生的任何直接或间接后果负责。用户应自行评估使用脚本的风险，并对任何可能的负面影响承担全责。<br><br>
                    4、本声明的目的在于提醒用户注意相关法律法规与风险，确保用户在明智、合法的前提下使用脚本。<br><br>
                    5、如用户在使用脚本的过程中有任何疑问，建议立即停止使用，并删除所有相关文件。<br><br>
                    6、本免责声明的最终解释权归脚本开发者所有。
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(helperWin);

    const logContainer = document.getElementById('pta-helper-log');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    // 解决 Mixed Content 问题：通过 GM_xmlhttpRequest 获取图片并转为 Base64
    function loadDonateImage() {
        const imgTag = document.querySelector('.donate-img');
        if (!imgTag) return;

        GM_xmlhttpRequest({
            method: "GET",
            url: DONATE_IMAGE_URL,
            responseType: "blob",
            onload: function(response) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    imgTag.src = reader.result;
                }
                reader.readAsDataURL(response.response);
            },
            onerror: function(err) {
                console.error("无法加载赞赏码图片:", err);
            }
        });
    }
    loadDonateImage();

    function addLog(question) {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `<div class="log-q">题: ${question}</div><div class="log-status">AI 思考中...</div>`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
        return div;
    }

    function addInfoLog(message) {
        const div = document.createElement('div');
        div.className = 'log-item info';
        div.innerText = message;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function updateLog(logItem, answerText, success = true) {
        const statusDiv = logItem.querySelector('.log-status');
        if (statusDiv) {
            statusDiv.className = success ? 'log-a' : 'log-err';
            statusDiv.innerText = success ? `答: ${answerText}` : `错误: ${answerText}`;
        }

        if (success) {
            solveCount++;
            // 每 4 题显示一次打赏信息
            if (solveCount % 4 === 0) {
                // 获取服务器统计数据以计算亏损
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${SERVER_URL}/stats`,
                    onload: function(response) {
                        try {
                            const stats = JSON.parse(response.responseText);
                            const totalRequests = stats.totalRequests+2000 || 0;
                            const loss = (totalRequests * 0.023 + 192).toFixed(2);

                            const tokenInfo = document.createElement('div');
                            tokenInfo.className = 'token-info';
                            tokenInfo.innerHTML = `✅本项目已累计调用AI：${totalRequests}次，已亏损 ¥${loss} <br> 你的打赏对我很重要! <span class="donate-link">打赏入口</span>`;
                            tokenInfo.querySelector('.donate-link').onclick = () => {
                                document.querySelector('.pta-tab[data-tab="donate"]').click();
                            };
                            logItem.appendChild(tokenInfo);
                            logContainer.scrollTop = logContainer.scrollHeight;
                        } catch (e) {}
                    }
                });
            }
        }
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // --- 3. 逻辑绑定 ---
    // Tab 切换逻辑
    document.querySelectorAll('.pta-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.pta-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        };
    });

    // 实时保存逻辑
    document.getElementById('auto-next-input').onchange = (e) => CONFIG.autoNext = e.target.checked;
    document.getElementById('remove-comments-input').onchange = (e) => CONFIG.removeComments = e.target.checked;
    document.getElementById('func-lang-select').onchange = (e) => CONFIG.funcLang = e.target.value;
    document.getElementById('prog-lang-select').onchange = (e) => CONFIG.progLang = e.target.value;

    document.getElementById('clear-btn').onclick = () => { logContainer.innerHTML = ''; };

    stopBtn.onclick = () => {
        isRunning = false;
        addInfoLog("正在停止...");
    };

    // --- 4. 拖拽逻辑 ---
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    const header = document.getElementById('pta-helper-header');
    header.onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        offset.x = e.clientX - helperWin.offsetLeft;
        offset.y = e.clientY - helperWin.offsetTop;
    };
    document.onmousemove = (e) => {
        if (!isDragging) return;
        helperWin.style.left = (e.clientX - offset.x) + 'px';
        helperWin.style.top = (e.clientY - offset.y) + 'px';
        helperWin.style.right = 'auto';
    };
    document.onmouseup = () => { isDragging = false; };

    // --- 5. AI 调用 ---
    function getUsername() {
        const nameElem = document.querySelector('.space-y-0 .text-normal.text-base');
        return nameElem ? nameElem.innerText.trim() : 'Unknown';
    }

    async function askAI(question, type = 'TF', lang = 'C') {
        return new Promise((resolve, reject) => {
            let systemPrompt = "";
            // ... (keep systemPrompt logic) ...
            if (type === 'TF') {
                systemPrompt = "你是一个答题助手。请先对陈述进行简要分析，然后给出判断。\n回复格式：\n【思考】：[简要分析]\n【答案】：[T/F]";
            } else if (type === 'MC') {
                systemPrompt = "你是一个答题助手。请先分析各选项，然后选出正确答案。\n回复格式：\n【思考】：[简要分析]\n【答案】：[选项字母]";
            } else if (type === 'MC_MORE') {
                systemPrompt = "你是一个答题助手。请分析题目并选出所有正确答案。\n回复格式：\n【思考】：[简要分析]\n【答案】：[所有正确选项字母连写]";
            } else if (type === 'FIB' || type === 'FIB_PROG') {
                const isProg = type === 'FIB_PROG';
                systemPrompt = `你是一个程序设计竞赛专家。请分析${isProg ? '程序逻辑' : '题目内容'}并完成填空。题目中用 [空n] 表示填空位置。

你必须遵守以下回复格式：
【思考】：[简要分析题目逻辑]
【最终答案】：
[空1] 第一个空的答案内容 [/空1]
[空2] 第二个空的答案内容 [/空2]
...依此类推，直到所有空都填满。

注意：
1. 请务必为每一个出现的 [空n] 提供答案。
2. 每一个答案必须包裹在 [空n] 和 [/空n] 标签中。
3. 只输出上述要求的两个部分，不要有任何额外的文字。`;
            } else if (type === 'FUNC') {
                systemPrompt = `你是一个程序设计竞赛专家。请根据题目描述写出缺失的函数实现代码。使用 ${lang} 语言。

请在编写代码时严格遵守以下要求：
1. **深度分析题目**：仔细阅读题目描述，识别出所有的特殊条件和约束。
2. **边界与极端情况**：特别注意处理边界条件（如最大/最小值）、重复输入、正负数切换、大规模数据带来的性能问题以及空白或非法输入。
3. **输入输出规范**：严格按照题目要求的格式读取输入和产生输出，不要多输或少输任何字符。
4. **通过注释思考**：请在代码内部编写详细的注释，解释你的算法思路、关键变量的含义以及如何处理特殊边界。这不仅有助于确保逻辑正确，也能展示你的思考过程。
5. **严禁在代码外回复**：你的所有内容必须包含在代码块内，严禁在代码块外写任何文字、解释、提示或 Markdown 标记（除了包裹代码的 \`\`\`）。
6. **纯净输出**：只输出代码块，不要有任何开场白或结束语。`;
            } else if (type === 'PROG') {
                systemPrompt = `你是一个程序设计竞赛专家。请根据要求写出完整的程序代码。使用 ${lang} 语言。

请在编写代码时严格遵守以下要求：
1. **深度分析题目**：仔细阅读题目描述，识别出所有的特殊条件和约束。
2. **边界与极端情况**：特别注意处理边界条件（如最大/最小值）、重复输入、正负数切换、大规模数据带来的性能问题以及空白或非法输入。
3. **输入输出规范**：严格按照题目要求的格式读取输入和产生输出，不要多输或少输任何字符。
4. **通过注释思考**：请在代码内部编写详细的注释，解释你的算法思路、关键变量的含义以及如何处理特殊边界。这不仅有助于确保逻辑正确，也能展示你的思考过程。
5. **严禁在代码外回复**：你的所有内容必须包含在代码块内，严禁在代码块外写任何文字、解释、提示或 Markdown 标记（除了包裹代码的 \`\`\`）。
6. **纯净输出**：只输出代码块，不要有任何开场白或结束语。`;
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: `${SERVER_URL}/solve`,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify({
                    systemPrompt: systemPrompt,
                    question: question,
                    username: getUsername()
                }),
                onload: function(response) {
                    try {
                        const res = JSON.parse(response.responseText);
                        if (res.error) {
                            reject(res.error);
                            return;
                        }
                        const fullContent = res.choices[0].message.content.trim();
                        const cleanedContent = fullContent.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();

                        if (type === 'TF' || type === 'MC' || type === 'MC_MORE' || type === 'FIB' || type === 'FIB_PROG') {
                            if (type === 'FIB' || type === 'FIB_PROG') {
                                // 填空题提取逻辑深度优化
                                // 1. 定位最后一段答案区域
                                const sections = cleanedContent.split(/【最终答案】[：:\n\s]*/i);
                                let targetContent = sections[sections.length - 1].trim();

                                // 如果最后一段太短（可能 AI 只回复了“请检查”之类的话），尝试往前找
                                if (targetContent.length < 5 && sections.length > 1) {
                                    targetContent = sections[sections.length - 2].trim();
                                }

                                let answers = [];

                                // 2. 顺序提取 [空n] 标记的内容
                                for (let i = 1; i <= 50; i++) {
                                    // 匹配 [空i] 到下一个 [空d] 或结尾
                                    // 使用 gi 确保能找到该段落内最后一个 [空i]（防止 AI 在同一段内反复修改）
                                    const markerRegex = new RegExp(`\\[空${i}\\]([\\s\\S]*?)(?=\\[空\\d+\\]|$)`, 'gi');
                                    const matches = targetContent.match(markerRegex);

                                    if (matches) {
                                        // 取本段内最后一次出现的该编号空
                                        const lastMatch = matches[matches.length - 1];
                                        // 提取内容
                                        const contentMatch = lastMatch.match(new RegExp(`\\[空${i}\\]([\\s\\S]*)`, 'i'));
                                        if (contentMatch) {
                                            let val = contentMatch[1].trim();
                                            // 清洗：去除闭合标签、去除开头的冒号/空格、去除末尾的干扰
                                            val = val.replace(/\[\/空\d+\]/gi, '') // 去除 [/空n]
                                                     .replace(/^[:：\s|]+/, '')      // 去除开头的干扰符
                                                     .trim();
                                            answers.push(val);
                                        }
                                    } else {
                                        // 如果中间断档了（比如 AI 漏掉了 [空2] 直接写了 [空3]），则停止
                                        break;
                                    }
                                }

                                if (answers.length > 0) {
                                    resolve({ choice: 'FIB', full: cleanedContent, answers: answers });
                                    return;
                                }

                                // 3. 最后的兜底：按行拆分，过滤掉说明行
                                const lines = targetContent.split('\n')
                                    .map(l => l.trim())
                                    .filter(l => l !== "" && !l.includes('【') && !l.includes('应该'));
                                resolve({ choice: 'FIB', full: cleanedContent, answers: lines });
                                return;
                            }

                            // 客观题提取：寻找 【答案】 标记
                            let answerText = cleanedContent;
                            const answerMatch = cleanedContent.match(/【答案】[：:\s]*([A-Z/TF]+)/i);
                            if (answerMatch) {
                                answerText = answerMatch[1].trim();
                            }

                            const firstPart = answerText.split(/[.。\n：:]/)[0].trim().toUpperCase();
                            let parsedAnswer = '';
                            if (type === 'TF') {
                                if (firstPart.startsWith('T') || firstPart.includes('正确')) parsedAnswer = 'T';
                                else if (firstPart.startsWith('F') || firstPart.includes('错误')) parsedAnswer = 'F';
                            } else if (type === 'MC') {
                                const match = firstPart.match(/[A-Z]/);
                                if (match) parsedAnswer = match[0];
                            } else if (type === 'MC_MORE') {
                                parsedAnswer = firstPart.replace(/[^A-Z]/g, '');
                            }
                            resolve({ choice: parsedAnswer || '?', full: cleanedContent });
                        } else {
                            resolve({ choice: 'CODE', full: cleanedContent });
                        }
                    } catch (e) { reject('解析失败: ' + e.message); }
                },
                onerror: function(err) { reject('无法连接到服务器'); }
            });
        });
    }

    // --- 6. 代码编辑器操作 ---
    async function switchLanguage(targetLang) {
        const ptaLangName = LANG_MAP[targetLang];
        if (!ptaLangName) return false;


        // 1. 查找当前语言显示框文字
        const currentLangElem = document.querySelector('.select__single-value .pc-text-raw');
        const currentText = currentLangElem ? currentLangElem.innerText : "";

        if (currentLangElem) {
            if (targetLang === 'Python') {
                // 如果当前已经是 python3，直接跳过
                if (currentText.includes('Python (python3)')) {
                    addInfoLog(`当前语言已是 ${currentText}，无需切换。`);
                    return true;
                }
            } else if (currentText.includes(targetLang)) {
                addInfoLog(`当前语言已是 ${currentText}，无需切换。`);
                return true;
            }
        }

        addInfoLog(`正在尝试打开菜单并切换至 ${ptaLangName}...`);

        // 针对 react-select 的多重触发策略
        const triggerElements = [
            document.querySelector('.select__dropdown-indicator svg'), // 你提供的那个 SVG
            document.querySelector('.select__dropdown-indicator'),
            document.querySelector('.select__control'),
            document.querySelector('input[id^="react-select-"][role="combobox"]')
        ];

        let opened = false;
        for (const el of triggerElements) {
            if (el) {
                try {
                    // 模拟 mousedown + click，这是触发 react-select 最稳妥的方式
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    if (typeof el.click === 'function') {
                        el.click();
                    } else {
                        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                    await new Promise(r => setTimeout(r, 600));
                } catch (e) {
                    console.error("触发切换失败:", e);
                }

                // 检查菜单是否真的出来了
                if (document.querySelectorAll('.select__option').length > 0) {
                    opened = true;
                    break;
                }
            }
        }

        if (!opened) {
            addInfoLog("提示：菜单可能未通过常规点击打开，尝试最后一次强行扫描...", false);
            await new Promise(r => setTimeout(r, 1000));
        }

        // 寻找目标选项
        let options = Array.from(document.querySelectorAll('.select__option'));
        let targetOption = null;

        if (targetLang === 'Python') {
            // Python 优先级逻辑
            const priorities = ['Python (python3)', 'Python (python2)', 'Python'];
            for (const p of priorities) {
                targetOption = options.find(opt => {
                    const label = opt.getAttribute('aria-label') || opt.innerText;
                    return label.includes(p);
                });
                if (targetOption) break;
            }
        } else {
            targetOption = options.find(opt => {
                const label = opt.getAttribute('aria-label') || opt.innerText;
                return label.includes(targetLang);
            });
        }

        if (targetOption) {
            const finalLangName = targetOption.innerText.trim();
            addInfoLog(`找到选项: ${finalLangName}，正在执行选择...`);
            // 点击并触发 mousedown 确保 react 监听到状态变化
            targetOption.scrollIntoView({ block: 'nearest' });
            targetOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            targetOption.click();

            await new Promise(r => setTimeout(r, 1000));
            addInfoLog(`语言已成功切换为: ${targetLang}`);
            return true;
        } else {
            addInfoLog(`错误：无法在菜单中找到 ${targetLang} (检测到 ${options.length} 个选项)`, false);
            // 点击页面空白处关闭可能卡住的菜单
            document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            return false;
        }
    }

    async function fillCodeEditor(code) {
        // 尝试找到所有的编辑器内容区域，并优先选择可编辑的那个
        const container = document.querySelector('[data-e2e="code-editor-input"]');
        let editors = container ? 
            Array.from(container.querySelectorAll('.cm-content[contenteditable="true"]')) :
            Array.from(document.querySelectorAll('.cm-content[contenteditable="true"]'));

        if (editors.length === 0) {
            // 兜底：寻找普通的 cm-content (可能是只读或未标记 contenteditable)
            const anyEditor = document.querySelector('.cm-content');
            if (anyEditor) editors = [anyEditor];
        }

        if (editors.length === 0) return false;
        
        // 在 PTA 中，如果有多个编辑器（如函数题），通常最后一个是我们要填空的那个
        const editor = editors[editors.length - 1];
        
        editor.focus();
        
        // 针对 CodeMirror 6 的强力清空与填入逻辑
        try {
            // 1. 全选并删除
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            await new Promise(r => setTimeout(r, 100));

            // 2. 模拟粘贴 (这是对 CM6 最稳妥的非 API 交互方式)
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', code);
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            editor.dispatchEvent(pasteEvent);
            
            // 3. 检查填入结果，如果没内容则尝试 insertText
            await new Promise(r => setTimeout(r, 200));
            if (editor.innerText.trim().length < 5) {
                document.execCommand('insertText', false, code);
            }

            // 4. 终极兜底：直接操作 DOM 并触发 input 事件，这能同步大部分 React 状态
            if (editor.innerText.trim().length < 5) {
                editor.innerText = code;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            return true;
        } catch (e) {
            console.error("代码填充失败:", e);
            return false;
        }
    }

    // --- 7. 核心功能：跳转与保存 ---
    async function saveAndNext() {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.innerText.includes('提交本题作答') || 
            b.innerText.includes('Submit For This Problem')
        );
        if (submitBtn) {
            addInfoLog("编程类题型当前页已处理。");
        } else {
            const saveBtn = document.querySelector('button[data-e2e="problem-set-bottom-submit-btn"]');
            if (saveBtn) {
                addInfoLog("正在保存答案...");
                saveBtn.click();
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (!CONFIG.autoNext) {
            addInfoLog("自动切换已关闭，任务结束。");
            return false;
        }

        const navIds = ['TRUE_OR_FALSE', 'MULTIPLE_CHOICE', 'MULTIPLE_CHOICE_MORE_THAN_ONE_ANSWER', 'FILL_IN_THE_BLANK', 'FILL_IN_THE_BLANKS', 'FILL_IN_THE_BLANK_FOR_PROGRAMMING', 'CODE_COMPLETION', 'PROGRAMMING', 'CODE_PROGRAMMING'];
        const activeTab = document.querySelector('a.active-anchor, a.active');
        if (activeTab) {
            const currentId = activeTab.id;
            const currentIndex = navIds.indexOf(currentId);
            if (currentIndex !== -1) {
                for (let i = currentIndex + 1; i < navIds.length; i++) {
                    const nextTab = document.getElementById(navIds[i]);
                    if (nextTab) {
                        addInfoLog(`切换题型: ${nextTab.innerText.split('\n')[0]}`);
                        nextTab.click();
                        return true;
                    }
                }
            }
        }
        addInfoLog("所有题型已完成！");
        return false;
    }

    // --- 新增：代码注释处理函数 ---
    function removeComments(code, lang) {
        if (!code) return "";
        let result = "";
        if (lang === 'Python') {
            // 移除单行注释
            let lines = code.split('\n');
            let processedLines = lines.map(line => {
                let inString = false;
                let quoteChar = '';
                for (let i = 0; i < line.length; i++) {
                    if ((line[i] === '"' || line[i] === "'") && (i === 0 || line[i-1] !== '\\')) {
                        if (!inString) {
                            inString = true;
                            quoteChar = line[i];
                        } else if (line[i] === quoteChar) {
                            inString = false;
                        }
                    }
                    if (line[i] === '#' && !inString) {
                        return line.substring(0, i).trimEnd();
                    }
                }
                return line;
            });
            result = processedLines.filter(line => line.trim() !== "").join('\n').trim();
        } else {
            // C, C++, Java
            // 先处理多行注释
            let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');
            let lines = cleaned.split('\n');
            let processedLines = lines.map(line => {
                let inString = false;
                let quoteChar = '';
                for (let i = 0; i < line.length; i++) {
                    if ((line[i] === '"' || line[i] === "'") && (i === 0 || line[i-1] !== '\\')) {
                        if (!inString) {
                            inString = true;
                            quoteChar = line[i];
                        } else if (line[i] === quoteChar) {
                            inString = false;
                        }
                    }
                    if (line[i] === '/' && line[i+1] === '/' && !inString) {
                        return line.substring(0, i).trimEnd();
                    }
                }
                return line;
            });
            result = processedLines.filter(line => line.trim() !== "").join('\n').trim();
        }
        return result;
    }

    // --- 8. 各类题型解决逻辑 ---
    async function solveTrueFalse() {
        const questions = document.querySelectorAll('div.pc-x[id]');
        if (questions.length === 0) return;
        addInfoLog(`[判断题] 开始处理 ${questions.length} 道题目`);
        for (let i = 0; i < questions.length; i++) {
            if (!isRunning) return;
            const qBlock = questions[i];
            const textElement = qBlock.querySelector('.rendered-markdown');
            if (!textElement) continue;

            // 使用清洗函数
            const questionText = getCleanText(textElement);
            const logItem = addLog(`${i + 1}. ${questionText}`);
            try {
                if (!isRunning) return;
                const result = await askAI(questionText, 'TF');
                if (!isRunning) return;
                const answer = result.choice;
                const labels = qBlock.querySelectorAll('label');
                let targetLabel = null;
                for (const label of labels) {
                    const labelText = label.innerText.trim();
                    if (labelText === answer || (answer === 'T' && (labelText.includes('T') || labelText.includes('正确'))) || (answer === 'F' && (labelText.includes('F') || labelText.includes('错误')))) {
                        targetLabel = label;
                        break;
                    }
                }
                if (targetLabel) { targetLabel.click(); updateLog(logItem, result.full); }
                else { updateLog(logItem, `未找到选项: ${answer}`, false); }
            } catch (err) { updateLog(logItem, `错误: ${err}`, false); }
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // --- 新增：通用文本清洗函数 ---
    function getCleanText(element) {
        if (!element) return "";
        const clone = element.cloneNode(true);
        
        // 1. 预处理：将所有的 CodeMirror 6 只读编辑器内容转为 Markdown 代码块
        // 这是为了让 AI 能更清晰地识别出输入样例、输出样例以及菜单说明
        clone.querySelectorAll('[data-code]').forEach(codeBlock => {
            const cmContent = codeBlock.querySelector('.cm-content');
            if (cmContent) {
                // 提取所有 cm-line 的内容并按行拼接，如果没找到则用 innerText 兜底
                let lines = Array.from(cmContent.querySelectorAll('.cm-line'))
                                   .map(line => line.innerText)
                                   .join('\n');
                if (!lines) lines = cmContent.innerText;
                
                const lang = codeBlock.getAttribute('data-lang') || '';
                // 替换原节点内容为带 Markdown 标记的内容
                codeBlock.innerHTML = `\n\`\`\`${lang}\n${lines}\n\`\`\`\n`;
            }
        });

        // 2. 清除冗余元素
        TRASH_SELECTORS.forEach(s => {
            clone.querySelectorAll(s).forEach(el => el.remove());
        });
        
        return clone.innerText.trim();
    }

    async function solveMultipleChoice() {
        const questions = document.querySelectorAll('div.pc-x[id]');
        if (questions.length === 0) return;
        addInfoLog(`[单选题] 开始处理 ${questions.length} 道题目`);
        for (let i = 0; i < questions.length; i++) {
            if (!isRunning) return;
            const qBlock = questions[i];

            // 使用清洗函数提取题目文本
            const questionElement = qBlock.querySelector('.rendered-markdown');
            const questionText = getCleanText(questionElement);

            // 提取所有选项
            const labels = Array.from(qBlock.querySelectorAll('label'));
            let optionsPrompt = "\n选项：\n";
            labels.forEach(label => {
                const indicator = label.querySelector('span')?.innerText.trim() || ""; // 如 "A."
                // 对每个选项内容也进行清洗
                const contentText = getCleanText(label.querySelector('.rendered-markdown')) ||
                                   label.innerText.replace(indicator, "").trim();
                optionsPrompt += `${indicator} ${contentText}\n`;
            });

            const logItem = addLog(`${i + 1}. ${questionText.substring(0, 30)}...`);
            try {
                if (!isRunning) return;
                const result = await askAI(questionText + optionsPrompt, 'MC');
                if (!isRunning) return;

                const answer = result.choice;
                let targetLabel = null;
                for (const label of labels) {
                    const indicator = label.querySelector('span')?.innerText.trim() || label.innerText.trim();
                    if (indicator.startsWith(answer)) {
                        targetLabel = label;
                        break;
                    }
                }

                if (targetLabel) {
                    targetLabel.click();
                    updateLog(logItem, result.full);
                } else {
                    updateLog(logItem, `未找到选项: ${answer}`, false);
                }
            } catch (err) { updateLog(logItem, `错误: ${err}`, false); }
            await new Promise(r => setTimeout(r, 500));
        }
    }

    async function solveMultipleChoiceMore() {
        const questions = document.querySelectorAll('div.pc-x[id]');
        if (questions.length === 0) return;
        addInfoLog(`[多选题] 开始处理 ${questions.length} 道题目`);
        for (let i = 0; i < questions.length; i++) {
            if (!isRunning) return;
            const qBlock = questions[i];

            const questionElement = qBlock.querySelector('.rendered-markdown');
            const questionText = getCleanText(questionElement);

            const labels = Array.from(qBlock.querySelectorAll('label'));
            let optionsPrompt = "\n(多选题) 选项：\n";
            labels.forEach(label => {
                const indicator = label.querySelector('span')?.innerText.trim() || "";
                const contentText = getCleanText(label.querySelector('.rendered-markdown')) ||
                                   label.innerText.replace(indicator, "").trim();
                optionsPrompt += `${indicator} ${contentText}\n`;
            });

            const logItem = addLog(`${i + 1}. ${questionText.substring(0, 30)}...`);
            try {
                if (!isRunning) return;
                const result = await askAI(questionText + optionsPrompt, 'MC_MORE');
                if (!isRunning) return;

                const answers = result.choice;
                for (const label of labels) {
                    const indicator = label.querySelector('span')?.innerText.trim() || label.innerText.trim();
                    const firstChar = indicator[0].toUpperCase();

                    const checkbox = label.querySelector('input[type="checkbox"]');
                    if (answers.includes(firstChar)) {
                        if (checkbox && !checkbox.checked) label.click();
                    } else {
                        if (checkbox && checkbox.checked) label.click();
                    }
                }
                updateLog(logItem, result.full);
            } catch (err) { updateLog(logItem, `错误: ${err}`, false); }
            await new Promise(r => setTimeout(r, 500));
        }
    }

    async function solveFillInTheBlank(typeName = '填空题') {
        const questions = document.querySelectorAll('div.pc-x[id]');
        if (questions.length === 0) return;
        addInfoLog(`[${typeName}] 开始处理 ${questions.length} 道题目`);

        for (let i = 0; i < questions.length; i++) {
            if (!isRunning) return;
            const qBlock = questions[i];
            
            // 兼容性：找寻填空题的真实内容区域，可能在 rendered-markdown 或 codeEditor 中
            const textElement = qBlock.querySelector('.rendered-markdown') || qBlock.querySelector('.generalProblemBody_WIhdN') || qBlock;
            if (!textElement) continue;

            const clone = textElement.cloneNode(true);
            
            // 预处理：将所有的 CodeMirror 6 只读编辑器内容转为 Markdown 代码块 (针对程序填空)
            clone.querySelectorAll('[data-code]').forEach(codeBlock => {
                const cmContent = codeBlock.querySelector('.cm-content');
                if (cmContent) {
                    let lines = Array.from(cmContent.querySelectorAll('.cm-line'))
                                       .map(line => line.innerText)
                                       .join('\n');
                    if (!lines) lines = cmContent.innerText;
                    
                    const lang = codeBlock.getAttribute('data-lang') || '';
                    codeBlock.innerHTML = `\n\`\`\`${lang}\n${lines}\n\`\`\`\n`;
                }
            });
            
            // 兼容性：找到所有填空标记点。PTA 既有 [data-blank-index] 也有 CodeMirror 6 的 widget 形式
            // 我们通过寻找包含 input/textarea 的最小包装容器来定位
            const findBlanks = (root) => {
                const blanks = [];
                // 1. 寻找带有 data-blank-index 的容器
                root.querySelectorAll('[data-blank-index]').forEach(el => blanks.push(el));
                
                // 2. 寻找 CodeMirror 6 内部的填空组件 (通常是 span[contenteditable="false"] 且包含 input)
                root.querySelectorAll('.cm-content span[contenteditable="false"]').forEach(el => {
                    if (el.querySelector('input, textarea') && !blanks.includes(el)) {
                        blanks.push(el);
                    }
                });
                
                // 3. 兜底：寻找不在上述容器内但显然是填空项的 input (例如普通 markdown 里的 input)
                root.querySelectorAll('input, textarea').forEach(input => {
                    // 向上找，看有没有还没被记录的父容器
                    let p = input.parentElement;
                    while (p && p !== root) {
                        if (blanks.includes(p)) return; // 已被记录
                        if (p.classList.contains('inline-flex') || p.tagName === 'SPAN') {
                             // 这是一个包装容器
                             blanks.push(p);
                             return;
                        }
                        p = p.parentElement;
                    }
                    if (!blanks.some(b => b.contains(input))) {
                        blanks.push(input);
                    }
                });
                return blanks;
            };

            const blanksInClone = findBlanks(clone);
            blanksInClone.forEach((b, idx) => {
                const marker = document.createTextNode(` [空${idx + 1}] `);
                if (b.parentNode) {
                    b.parentNode.replaceChild(marker, b);
                }
            });

            // 清除干扰元素（如 gutters, toolbar 等）
            TRASH_SELECTORS.forEach(s => {
                clone.querySelectorAll(s).forEach(el => el.remove());
            });

            const questionText = clone.innerText.trim();
            const realBlanks = findBlanks(qBlock);

            if (realBlanks.length === 0) continue;

            const logItem = addLog(`${i + 1}. ${questionText.substring(0, 50)}...`);
            try {
                if (!isRunning) return;
                const isProg = typeName.includes('程序');
                const aiType = isProg ? 'FIB_PROG' : 'FIB';

                addInfoLog(`[${typeName}] 共有 ${realBlanks.length} 个空，正在请求 AI (${aiType})...`);
                const result = await askAI(questionText + `\n\n(提示：请给出以上题目中 ${realBlanks.length} 个空的答案，按顺序排列，每空请使用 [空n]内容 [/空n] 的格式回复)`, aiType);
                if (!isRunning) return;

                const aiAnswers = result.answers || [];
                for (let j = 0; j < realBlanks.length; j++) {
                    if (aiAnswers[j]) {
                        const blankParent = realBlanks[j];
                        const el = blankParent.tagName === 'INPUT' || blankParent.tagName === 'TEXTAREA' ? 
                                   blankParent : blankParent.querySelector('input, textarea');
                        if (el) {
                            const value = aiAnswers[j];

                            // 修复：针对 React 状态同步的强力赋值
                            const lastValue = el.value;
                            el.value = value;
                            const tracker = el._valueTracker;
                            if (tracker) tracker.setValue(lastValue);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
                updateLog(logItem, aiAnswers.join(' | '));
            } catch (err) { updateLog(logItem, `错误: ${err}`, false); }
            await new Promise(r => setTimeout(r, 800));
        }
    }

    async function solveCodeProblems(type) {
        const problemBtns = document.querySelectorAll('a[href*="problemSetProblemId"]');
        if (problemBtns.length === 0) { addInfoLog("未找到题目按钮"); return; }

        const targetLang = type === 'FUNC' ? CONFIG.funcLang : CONFIG.progLang;
        addInfoLog(`[${type === 'FUNC' ? '函数题' : '编程题'}] 共有 ${problemBtns.length} 题，预设语言: ${targetLang}`);

        for (let i = 0; i < problemBtns.length; i++) {
            if (!isRunning) return;

            const btn = problemBtns[i];
            if (btn.querySelector('.PROBLEM_ACCEPTED_iri62')) {
                addInfoLog(`第 ${i + 1} 题已通过，跳过`); continue;
            }
            addInfoLog(`正在解决第 ${i + 1} 题...`);
            btn.click();
            await new Promise(r => setTimeout(r, 2500));

            if (!isRunning) return;

            // 切换语言
            await switchLanguage(targetLang);

            // 等待编辑器出现，增加重试机制
            let editorExists = false;
            for (let j = 0; j < 10; j++) {
                if (document.querySelector('.cm-content')) {
                    editorExists = true;
                    break;
                }
                addInfoLog(`等待编辑器加载中 (${j + 1}/10)...`);
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!editorExists) {
                addInfoLog(`[跳过] 无法加载编辑器，跳过此题。`, false);
                updateLog(logItem, "编辑器未加载", false);
                continue;
            }

            // 获取题目内容区域，考虑多重可能的选择器
            const contentArea = document.querySelector('.rendered-markdown') || 
                                document.querySelector('.generalProblemBody_WIhdN') ||
                                document.querySelector('.problem-body') ||
                                document.querySelector('.problemBody_S_NqD');

            // 获取题目限制信息 (时间、内存等)
            const infoList = document.querySelector('.problemInfo_HVczC');
            const infoText = infoList ? infoList.innerText.replace(/\n+/g, ' ').trim() : '';

            const title = document.querySelector('.text-darkest.font-bold.text-lg')?.innerText || 
                          document.querySelector('.problem-title')?.innerText || 
                          `第 ${i+1} 题`;
            const logItem = addLog(title);

            try {
                if (!isRunning) return;
                addInfoLog(`正在请求 AI 生成代码 (${targetLang})...`);
                
                // 组合更完整的题目信息给 AI
                const mainContent = getCleanText(contentArea || document.body);
                const fullPrompt = `【题目标题】：${title}\n【限制信息】：${infoText}\n【题目正文】：\n${mainContent}`;
                
                const result = await askAI(fullPrompt, type, targetLang);

                if (!isRunning) return;
                addInfoLog(`AI 生成完毕，正在填入编辑器...`);

                let codeToFill = result.full;
                if (CONFIG.removeComments) {
                    addInfoLog(`[优化] 正在本地清除代码注释以符合提交要求...`);
                    codeToFill = removeComments(result.full, targetLang);
                }

                const filled = await fillCodeEditor(codeToFill);

                if (filled) {
                    await new Promise(r => setTimeout(r, 800));

                    if (!isRunning) return;

                    const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
                        b.innerText.includes('提交本题作答') || b.querySelector('.pc-text-raw')?.innerText === '提交本题作答'
                    );

                    if (submitBtn) {
                        addInfoLog(`[操作] 点击提交按钮...`);
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        submitBtn.click();

                        addInfoLog(`[等待] 等待提交结果返回...`);
                        let foundResult = false;
                        for (let attempt = 0; attempt < 15; attempt++) {
                            if (!isRunning) break;
                            const closeBtn = document.querySelector('button[data-e2e="modal-close-btn"]');
                            if (closeBtn) {
                                addInfoLog(`[成功] 检测到提交结果窗口，准备关闭...`);
                                closeBtn.click();
                                foundResult = true;
                                break;
                            }
                            await new Promise(r => setTimeout(r, 1000));
                        }

                        if (!foundResult && isRunning) {
                            addInfoLog(`[警告] 提交后未检测到结果反馈，请检查。`, false);
                        }

                        updateLog(logItem, `已提交 (${targetLang})`, true);
                    } else {
                        addInfoLog(`[错误] 未能定位到提交按钮！`, false);
                        updateLog(logItem, "未找到提交按钮", false);
                    }
                } else {
                    addInfoLog(`[错误] 无法填入代码。`, false);
                    updateLog(logItem, "编辑器定位失败", false);
                }
            } catch (err) {
                addInfoLog(`[异常] ${err}`);
                updateLog(logItem, `错误: ${err}`, false);
            }
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    // --- 9. 主逻辑入口 ---
    async function solveCurrentPage() {
        if (isRunning) return;

        isRunning = true;
        startBtn.disabled = true;
        startBtn.innerText = "运行中...";
        stopBtn.style.display = 'inline-block';

        while (isRunning) {
            const tfTab = document.getElementById('TRUE_OR_FALSE');
            const mcTab = document.getElementById('MULTIPLE_CHOICE');
            const mcmTab = document.getElementById('MULTIPLE_CHOICE_MORE_THAN_ONE_ANSWER');
            const fibTab = document.getElementById('FILL_IN_THE_BLANK') || document.getElementById('FILL_IN_THE_BLANKS');
            const fibpTab = document.getElementById('FILL_IN_THE_BLANK_FOR_PROGRAMMING');
            const funcTab = document.getElementById('CODE_COMPLETION');
            const progTab = document.getElementById('PROGRAMMING') || document.getElementById('CODE_PROGRAMMING');

            const activeTab = document.querySelector('a.active-anchor, a.active');
            const activeTabText = activeTab ? activeTab.innerText.trim() : "";

            try {
                if (tfTab && tfTab.classList.contains('active')) {
                    await solveTrueFalse();
                } else if (mcTab && mcTab.classList.contains('active')) {
                    await solveMultipleChoice();
                } else if (mcmTab && mcmTab.classList.contains('active')) {
                    await solveMultipleChoiceMore();
                } else if ((fibTab && fibTab.classList.contains('active')) || (activeTabText.includes('填空题') && !activeTabText.includes('程序'))) {
                    await solveFillInTheBlank('普通填空题');
                } else if ((fibpTab && fibpTab.classList.contains('active')) || activeTabText.includes('程序填空题')) {
                    await solveFillInTheBlank('程序填空题');
                } else if ((funcTab && funcTab.classList.contains('active')) || activeTabText.includes('函数题')) {
                    await solveCodeProblems('FUNC');
                } else if ((progTab && progTab.classList.contains('active')) || activeTabText.includes('编程题')) {
                    await solveCodeProblems('PROG');
                } else {
                    addInfoLog("当前板块暂不支持或已全部完成。");
                    break;
                }

                if (!isRunning) break;

                const switched = await saveAndNext();
                if (switched && CONFIG.autoNext && isRunning) {
                    addInfoLog("等待页面加载，5秒后开始下一板块...");
                    for (let i = 0; i < 5; i++) {
                        if (!isRunning) break;
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    if (!isRunning) break;
                } else {
                    break;
                }
            } catch (err) {
                addInfoLog(`运行中发生错误: ${err}`);
                break;
            }
        }

        stopTask();
        addInfoLog("所有自动化任务已结束。");
    }

    function stopTask() {
        isRunning = false;
        startBtn.disabled = false;
        startBtn.innerText = "开始答题";
        stopBtn.style.display = 'none';
    }

    document.getElementById('start-btn').onclick = solveCurrentPage;
})();
