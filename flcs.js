// ==UserScript==
// @name         新职汇全能答题助手
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  支持选择题、判断题和简答题，增加自动隐藏悬浮窗、简答题自动复制、智能滚动等功能
// @author       Your name
// @match        http://182.92.8.169/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 从远程加载题库数据
    let questionBank = [];
    const questionBankUrl = 'https://cdn.jsdelivr.net/gh/asd2261/question-bank@main/question-bank.json';

    // 全局变量，用于控制答题过程
    let isAnswering = false;
    let pauseAnswering = false;
    let currentQuestionRows = [];
    let currentIndex = 0;
    let totalQuestions = 0;

    // 简答题相关变量
    let currentEssayQuestions = [];
    let currentEssayIndex = 0;
    let totalEssayQuestions = 0;
    let isEssayMode = false; // 是否处于简答题模式

    // 新增功能相关变量
    let mouseTimer = null; // 鼠标未动计时器
    let autoScrollEnabled = true; // 自动滚动是否启用
    let lastMouseTime = Date.now(); // 上次鼠标活动时间

    // 创建悬浮窗口
    function createFloatingWindow() {
        // 创建悬浮窗口的主体
        const floatDiv = document.createElement('div');
        floatDiv.id = 'answerAssistant';
        floatDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: Arial, sans-serif;
            overflow: hidden;
            transition: all 0.3s ease;
            opacity: 0.3;
            transform: translateX(0);
        `;

        // 添加鼠标悬停事件
        floatDiv.addEventListener('mouseenter', function() {
            this.style.opacity = '1';
        });

        floatDiv.addEventListener('mouseleave', function() {
            this.style.opacity = '0.3';
        });

        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            background-color: #4CAF50;
            color: white;
            padding: 10px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        titleBar.textContent = '新职汇全能答题助手';

        // 创建关闭按钮
        const closeButton = document.createElement('span');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            cursor: pointer;
            font-size: 20px;
        `;
        closeButton.onclick = function() {
            document.body.removeChild(floatDiv);
        };
        titleBar.appendChild(closeButton);

        // 创建内容区域
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            padding: 15px;
        `;

        // 创建模式切换按钮区域
        const modeButtonsDiv = document.createElement('div');
        modeButtonsDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        `;

        // 创建选择/判断题模式按钮
        const choiceButton = document.createElement('button');
        choiceButton.id = 'choiceButton';
        choiceButton.textContent = '选择/判断题';
        choiceButton.style.cssText = `
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 48%;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        choiceButton.onclick = function() {
            isEssayMode = false;
            updateUIForMode();
        };

        // 创建简答题模式按钮
        const essayButton = document.createElement('button');
        essayButton.id = 'essayButton';
        essayButton.textContent = '简答题';
        essayButton.style.cssText = `
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 48%;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        essayButton.onclick = function() {
            isEssayMode = true;
            updateUIForMode();
        };

        modeButtonsDiv.appendChild(choiceButton);
        modeButtonsDiv.appendChild(essayButton);

        // 创建开始/暂停按钮 (用于选择/判断题模式)
        const startPauseButton = document.createElement('button');
        startPauseButton.id = 'startPauseButton';
        startPauseButton.textContent = '开始答题';
        startPauseButton.style.cssText = `
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            margin-bottom: 10px;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        startPauseButton.onclick = toggleAnswering;

        // 创建查询按钮 (用于简答题模式)
        const queryButton = document.createElement('button');
        queryButton.id = 'queryButton';
        queryButton.textContent = '查询简答题';
        queryButton.style.cssText = `
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            margin-bottom: 10px;
            font-weight: bold;
            transition: background-color 0.3s ease;
            display: none; /* 初始隐藏 */
        `;
        queryButton.onclick = findEssayQuestions;

        // 创建导航按钮区域 (用于简答题模式)
        const navButtonsDiv = document.createElement('div');
        navButtonsDiv.id = 'navButtonsDiv';
        navButtonsDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            display: none; /* 初始隐藏 */
        `;

        // 创建上一题按钮
        const prevButton = document.createElement('button');
        prevButton.id = 'prevButton';
        prevButton.textContent = '上一题';
        prevButton.style.cssText = `
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 48%;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        prevButton.onclick = showPreviousQuestion;
        prevButton.disabled = true;
        prevButton.style.opacity = '0.5';

        // 创建下一题按钮
        const nextButton = document.createElement('button');
        nextButton.id = 'nextButton';
        nextButton.textContent = '下一题';
        nextButton.style.cssText = `
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            width: 48%;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        nextButton.onclick = showNextQuestion;
        nextButton.disabled = true;
        nextButton.style.opacity = '0.5';

        navButtonsDiv.appendChild(prevButton);
        navButtonsDiv.appendChild(nextButton);

        // 创建当前题目信息显示区域
        const currentQuestionInfo = document.createElement('div');
        currentQuestionInfo.id = 'currentQuestionInfo';
        currentQuestionInfo.style.cssText = `
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.4;
            max-height: 150px;
            overflow-y: auto;
            margin-bottom: 10px;
        `;
        currentQuestionInfo.innerHTML = '准备就绪，请选择模式并开始答题。';

        // 创建状态信息区域
        const statusInfo = document.createElement('div');
        statusInfo.id = 'statusInfo';
        statusInfo.style.cssText = `
            font-size: 12px;
            color: #666;
            text-align: center;
        `;
        statusInfo.textContent = '加载题库中...';

        // 组装悬浮窗
        contentDiv.appendChild(modeButtonsDiv);
        contentDiv.appendChild(startPauseButton);
        contentDiv.appendChild(queryButton);
        contentDiv.appendChild(navButtonsDiv);
        contentDiv.appendChild(currentQuestionInfo);
        contentDiv.appendChild(statusInfo);
        floatDiv.appendChild(titleBar);
        floatDiv.appendChild(contentDiv);
        document.body.appendChild(floatDiv);

        // 加载远程题库
        fetch(questionBankUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络响应不正常');
                }
                return response.json();
            })
            .then(data => {
                questionBank = data.map(item => ({
                    question: item.question,
                    correctAnswer: item.answer
                }));
                statusInfo.textContent = `题库加载完成，共 ${questionBank.length} 题`;
            })
            .catch(error => {
                statusInfo.textContent = `题库加载失败: ${error.message}`;
                statusInfo.style.color = '#f44336';
            });
    }

    // 根据当前模式更新UI
    function updateUIForMode() {
        const startPauseButton = document.getElementById('startPauseButton');
        const queryButton = document.getElementById('queryButton');
        const navButtonsDiv = document.getElementById('navButtonsDiv');
        const choiceButton = document.getElementById('choiceButton');
        const essayButton = document.getElementById('essayButton');
        const currentQuestionInfo = document.getElementById('currentQuestionInfo');

        if (isEssayMode) {
            // 简答题模式
            startPauseButton.style.display = 'none';
            queryButton.style.display = 'block';
            navButtonsDiv.style.display = 'flex';
            choiceButton.style.backgroundColor = '#808080';
            essayButton.style.backgroundColor = '#2196F3';
            currentQuestionInfo.innerHTML = '准备就绪，点击查询简答题按钮开始查询。';
        } else {
            // 选择/判断题模式
            startPauseButton.style.display = 'block';
            queryButton.style.display = 'none';
            navButtonsDiv.style.display = 'none';
            choiceButton.style.backgroundColor = '#4CAF50';
            essayButton.style.backgroundColor = '#808080';
            currentQuestionInfo.innerHTML = '准备就绪，点击开始答题按钮开始自动答题。';
        }
    }

    // 辅助函数：生成随机延迟时间
    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 辅助函数：模拟鼠标移动和点击
    function simulateHumanClick(element) {
        return new Promise(resolve => {
            // 先模拟鼠标悬停
            const mouseoverEvent = new MouseEvent('mouseover', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(mouseoverEvent);

            // 随机延迟后模拟点击
            setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                element.dispatchEvent(clickEvent);
                resolve();
            }, getRandomDelay(300, 1200)); // 随机延迟300-1200ms
        });
    }

    // 开始/暂停答题切换函数 (选择/判断题模式)
    function toggleAnswering() {
        const button = document.getElementById('startPauseButton');

        if (!isAnswering) {
            // 开始答题
            isAnswering = true;
            pauseAnswering = false;
            button.textContent = '暂停答题';
            button.style.backgroundColor = '#f44336';

            // 重置计数器
            currentQuestionRows = document.querySelectorAll('#papertable tr[id^="tr"]');
            totalQuestions = currentQuestionRows.length;
            currentIndex = 0;

            // 添加调试信息
            console.log('找到题目行数：', totalQuestions);
            document.getElementById('statusInfo').textContent = `找到题目：${totalQuestions}`;

            // 开始答题过程
            processNextQuestion();
        } else {
            if (pauseAnswering) {
                // 继续答题
                pauseAnswering = false;
                button.textContent = '暂停答题';
                button.style.backgroundColor = '#f44336';
                processNextQuestion();
            } else {
                // 暂停答题
                pauseAnswering = true;
                button.textContent = '继续答题';
                button.style.backgroundColor = '#ff9800';
            }
        }
    }

    // 处理下一个问题 (选择/判断题模式)
    async function processNextQuestion() {
        if (pauseAnswering || !isAnswering) return;

        if (currentIndex >= totalQuestions) {
            // 答题完成
            finishAnswering();
            return;
        }

        const row = currentQuestionRows[currentIndex];
        currentIndex++;

        // 获取题目文本
        const questionDiv = row.querySelector('div[name^="DIV"]');
        if (!questionDiv) {
            processNextQuestion();
            return;
        }

        const questionTable = questionDiv.querySelector('table');
        if (!questionTable) {
            processNextQuestion();
            return;
        }

        const questionTd = questionTable.querySelector('td[valign="top"][style*="width"]');
        if (!questionTd) {
            processNextQuestion();
            return;
        }

        // 提取题目文本
        const paragraphs = questionTd.querySelectorAll('p');
        if (paragraphs.length < 2) {
            processNextQuestion();
            return;
        }

        const questionText = paragraphs[0].textContent.trim();
        // 移除题号和括号
        const cleanQuestion = questionText.replace(/^\d+、\s*|(（\s*）\s*。*$)/g, '');

        // 随机暂停一段时间，模拟阅读题目
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(1000, 3000)));

        // 提取所有选项文本和对应的按钮
        const optionsMap = new Map();

        // 检查是否是简答题（查找textarea元素）
        const textarea = row.querySelector('textarea[name^="TLX"]');
        const isEssayQuestion = !!textarea;

        // 如果是简答题，跳过处理下一题
        if (isEssayQuestion) {
            processNextQuestion();
            return;
        }

        // 检查是否是多选题（查找checkbox类型的输入）
        const checkboxes = row.querySelectorAll('input[type="checkbox"]');
        const isMultipleChoice = checkboxes.length > 0;

        // 根据题目类型获取选项
        const options = isMultipleChoice ? checkboxes : row.querySelectorAll('input[type="radio"]');

        // 判断是否是判断题
        const isJudgmentQuestion = options.length === 2 &&
            ((options[0].nextSibling && options[0].nextSibling.textContent.includes('正确')) ||
             (options[1].nextSibling && options[1].nextSibling.textContent.includes('错误')));

        // 检查是否包含"以上都是"选项，如果有则跳过此题
        let hasAllOfTheAbove = false;

        for (let i = 0; i < paragraphs.length; i++) {
            const text = paragraphs[i].textContent.trim();
            if (text.includes('以上都是')) {
                hasAllOfTheAbove = true;
                break;
            }
        }

        if (hasAllOfTheAbove) {
            // 更新当前题目信息
            document.getElementById('currentQuestionInfo').innerHTML =
                `当前题目：${cleanQuestion}<br>答案：[跳过 - 包含"以上都是"选项]`;

            // 随机暂停，模拟思考时间
            await new Promise(resolve => setTimeout(resolve, getRandomDelay(800, 2000)));

            // 处理下一个问题
            processNextQuestion();
            return;
        }

        // 处理选项
        options.forEach(option => {
            // 获取选项标签（A、B、C、D）
            const optionLabel = option.nextSibling ? option.nextSibling.textContent.trim() : '';

            // 获取选项内容
            const optionIndex = Array.from(options).indexOf(option);
            if (optionIndex >= 0 && optionIndex + 1 < paragraphs.length) {
                const optionText = paragraphs[optionIndex + 1].textContent.trim();
                // 提取选项内容（去除前面的A.、B.等标识）
                const optionContent = optionText.replace(/^\s*[A-D]\.\s*/, '').trim();
                optionsMap.set(optionContent, option);
            }
        });

        let found = false;
        let correctAnswer = '';

        // 遍历题库中的每个问题
        for (let i = 0; i < questionBank.length && !found; i++) {
            const qbItem = questionBank[i];

            // 改进匹配逻辑：规范化处理题目文本，移除括号和多余空格
            const normalizedQuestion = cleanQuestion.replace(/（\s*）/g, '').replace(/\s+/g, ' ').trim();
            const normalizedBankQuestion = qbItem.question.replace(/（\s*）/g, '').replace(/\s+/g, ' ').trim();

            // 使用更灵活的匹配方式
            if (normalizedQuestion.includes(normalizedBankQuestion) ||
                normalizedBankQuestion.includes(normalizedQuestion) ||
                // 计算相似度，如果相似度超过80%也认为匹配
                calculateSimilarity(normalizedQuestion, normalizedBankQuestion) > 0.8) {

                correctAnswer = qbItem.correctAnswer;

                // 判断题的特殊处理
                if (isJudgmentQuestion) {
                    // 判断题的正确答案通常是"正确"或"错误"
                    const correctOption = correctAnswer.includes('正确') ? options[0] : options[1];

                    // 模拟人类点击行为
                    await simulateHumanClick(correctOption);
                    correctOption.checked = true;
                    found = true;
                }
                // 处理多选题的情况
                else if (isMultipleChoice) {
                    // 多选题的正确答案可能是多个，用分隔符分开
                    const correctAnswers = qbItem.correctAnswer.split('、').map(ans => ans.trim());

                    // 遍历所有选项，选中正确答案
                    for (const [optionContent, option] of optionsMap.entries()) {
                        // 检查当前选项是否是正确答案之一
                        const isCorrect = correctAnswers.some(answer =>
                            optionContent === answer ||
                            optionContent.includes(answer) ||
                            answer.includes(optionContent)
                        );

                        if (isCorrect) {
                            // 模拟人类点击行为
                            await simulateHumanClick(option);
                            option.checked = true;
                            found = true;
                        }
                    }
                } else {
                    // 精确匹配：遍历所有选项，寻找与正确答案完全匹配的选项
                    for (const [optionContent, option] of optionsMap.entries()) {
                        // 规范化处理选项内容和正确答案，移除多余空格
                        const normalizedOptionContent = optionContent.replace(/\s+/g, ' ').trim();
                        const normalizedCorrectAnswer = qbItem.correctAnswer.replace(/\s+/g, ' ').trim();

                        // 使用规范化后的文本进行精确匹配
                        if (normalizedOptionContent === normalizedCorrectAnswer) {
                            // 模拟人类点击行为
                            await simulateHumanClick(option);
                            option.checked = true;

                            found = true;
                            break;
                        }
                    }

                    // 如果没有找到精确匹配，尝试部分匹配
                    if (!found) {
                        for (const [optionContent, option] of optionsMap.entries()) {
                            // 规范化处理选项内容和正确答案，移除多余空格
                            const normalizedOptionContent = optionContent.replace(/\s+/g, ' ').trim();
                            const normalizedCorrectAnswer = qbItem.correctAnswer.replace(/\s+/g, ' ').trim();

                            if (normalizedOptionContent.includes(normalizedCorrectAnswer) ||
                                normalizedCorrectAnswer.includes(normalizedOptionContent)) {
                                // 模拟人类点击行为
                                await simulateHumanClick(option);
                                option.checked = true;

                                found = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!found) {
            correctAnswer = '未找到匹配答案';
        }

        // 更新当前题目信息
        document.getElementById('currentQuestionInfo').innerHTML =
            `当前题目：${cleanQuestion}<br>答案：${correctAnswer}`;

        // 随机暂停，模拟思考时间
        if (Math.random() < 0.3) { // 30%概率进行较长暂停
            await new Promise(resolve => setTimeout(resolve, getRandomDelay(3000, 8000)));
        } else {
            await new Promise(resolve => setTimeout(resolve, getRandomDelay(800, 2000)));
        }

        // 处理下一个问题
        if (!pauseAnswering) {
            processNextQuestion();
        }
    }

    // 完成答题 (选择/判断题模式)
    function finishAnswering() {
        isAnswering = false;
        document.getElementById('startPauseButton').textContent = '开始答题';
        document.getElementById('startPauseButton').style.backgroundColor = '#4CAF50';
        document.getElementById('currentQuestionInfo').innerHTML = '答题完成！';
    }

    // 查找所有简答题 (简答题模式)
    function findEssayQuestions() {
        // 获取所有题目行
        const allQuestionRows = document.querySelectorAll('#papertable tr[id^="tr"]');
        currentEssayQuestions = [];

        // 筛选出简答题
        allQuestionRows.forEach(row => {
            const textarea = row.querySelector('textarea[name^="TLX"]');
            if (textarea) {
                currentEssayQuestions.push(row);
            }
        });

        totalEssayQuestions = currentEssayQuestions.length;
        currentEssayIndex = 0;

        // 更新状态信息
        document.getElementById('statusInfo').textContent = `找到简答题：${totalEssayQuestions} 道`;

        // 显示第一道简答题
        if (totalEssayQuestions > 0) {
            showEssayQuestion(0);
        } else {
            document.getElementById('currentQuestionInfo').innerHTML = '未找到简答题！';
            // 更新导航按钮状态
            updateNavigationButtons();
        }
    }

    // 显示指定索引的简答题 (简答题模式)
    function showEssayQuestion(index) {
        if (index < 0 || index >= totalEssayQuestions) return;

        const row = currentEssayQuestions[index];

        // 获取题目文本
        const questionDiv = row.querySelector('div[name^="DIV"]');
        if (!questionDiv) return;

        const questionTable = questionDiv.querySelector('table');
        if (!questionTable) return;

        const questionTd = questionTable.querySelector('td[valign="top"][style*="width"]');
        if (!questionTd) return;

        // 提取题目文本
        const paragraphs = questionTd.querySelectorAll('p');
        if (paragraphs.length < 1) return;

        const questionText = paragraphs[0].textContent.trim();
        // 移除题号和括号
        const cleanQuestion = questionText.replace(/^\d+、\s*|(（\s*）\s*。*$)/g, '');
        // 截取前30个字符
        const shortQuestion = cleanQuestion.substring(0, 30) + (cleanQuestion.length > 30 ? '...' : '');

        let found = false;
        let correctAnswer = '';

        // 遍历题库中的每个问题
        for (let i = 0; i < questionBank.length && !found; i++) {
            const qbItem = questionBank[i];

            // 规范化处理题目文本
            const normalizedQuestion = cleanQuestion.replace(/(（\s*）)/g, '').replace(/\s+/g, ' ').trim();
            const normalizedBankQuestion = qbItem.question.replace(/(（\s*）)/g, '').replace(/\s+/g, ' ').trim();

            // 使用更灵活的匹配方式
            if (normalizedQuestion.includes(normalizedBankQuestion) ||
                normalizedBankQuestion.includes(normalizedQuestion) ||
                // 计算相似度，如果相似度超过80%也认为匹配
                calculateSimilarity(normalizedQuestion, normalizedBankQuestion) > 0.8) {

                correctAnswer = qbItem.correctAnswer;
                found = true;
            }
        }

        if (!found) {
            correctAnswer = '未找到匹配答案';
        }

        // 更新当前题目信息
        document.getElementById('currentQuestionInfo').innerHTML =
            `当前题目 (${index + 1}/${totalEssayQuestions})：${shortQuestion}<br>答案：${correctAnswer}`;

        // 自动复制答案到剪切板
        if (found) {
            copyToClipboard(correctAnswer);
            // 提示用户答案已复制
            const originalHTML = document.getElementById('currentQuestionInfo').innerHTML;
            document.getElementById('currentQuestionInfo').innerHTML =
                `当前题目 (${index + 1}/${totalEssayQuestions})：${shortQuestion}<br>答案：${correctAnswer}<br><span style="color: #4CAF50; font-size: 12px;">✓ 答案已自动复制到剪切板</span>`;
            setTimeout(() => {
                document.getElementById('currentQuestionInfo').innerHTML = originalHTML;
            }, 1000);
        }

        // 更新导航按钮状态
        updateNavigationButtons();

        // 为textarea添加点击事件，实现点击自动复制答案
        const textarea = row.querySelector('textarea[name^="TLX"]');
        if (textarea) {
            textarea.onclick = function() {
                if (found) {
                    copyToClipboard(correctAnswer);
                    // 提示用户答案已复制
                    const originalHTML = document.getElementById('currentQuestionInfo').innerHTML;
                    document.getElementById('currentQuestionInfo').innerHTML =
                        `当前题目 (${index + 1}/${totalEssayQuestions})：${shortQuestion}<br>答案：${correctAnswer}<br><span style="color: #4CAF50; font-size: 12px;">✓ 答案已复制到剪切板</span>`;
                    setTimeout(() => {
                        document.getElementById('currentQuestionInfo').innerHTML = originalHTML;
                    }, 1000);
                }
            };
        }
    }

    // 显示上一道简答题 (简答题模式)
    function showPreviousQuestion() {
        if (currentEssayIndex > 0) {
            currentEssayIndex--;
            showEssayQuestion(currentEssayIndex);
        }
    }

    // 显示下一道简答题 (简答题模式)
    function showNextQuestion() {
        if (currentEssayIndex < totalEssayQuestions - 1) {
            currentEssayIndex++;
            showEssayQuestion(currentEssayIndex);
        }
    }

    // 更新导航按钮状态 (简答题模式)
    function updateNavigationButtons() {
        const prevButton = document.getElementById('prevButton');
        const nextButton = document.getElementById('nextButton');

        if (totalEssayQuestions === 0) {
            prevButton.disabled = true;
            nextButton.disabled = true;
            prevButton.style.opacity = '0.5';
            nextButton.style.opacity = '0.5';
            return;
        }

        // 上一题按钮
        if (currentEssayIndex <= 0) {
            prevButton.disabled = true;
            prevButton.style.opacity = '0.5';
        } else {
            prevButton.disabled = false;
            prevButton.style.opacity = '1';
        }

        // 下一题按钮
        if (currentEssayIndex >= totalEssayQuestions - 1) {
            nextButton.disabled = true;
            nextButton.style.opacity = '0.5';
        } else {
            nextButton.disabled = false;
            nextButton.style.opacity = '1';
        }
    }

    // 计算字符串相似度的函数
    function calculateSimilarity(str1, str2) {
        // 简单的相似度计算：共同字符数 / 较长字符串长度
        const set1 = new Set(str1);
        const set2 = new Set(str2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        return intersection.size / Math.max(set1.size, set2.size);
    }

    // 复制文本到剪切板
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            // 使用现代 Clipboard API
            navigator.clipboard.writeText(text).then(() => {
                console.log('答案已复制到剪切板');
            }).catch(err => {
                console.error('复制失败:', err);
                fallbackCopyTextToClipboard(text);
            });
        } else {
            // 降级方案
            fallbackCopyTextToClipboard(text);
        }
    }

    // 降级复制方案
    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            console.log('答案已复制到剪切板（降级方案）');
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    }

    // 鼠标活动监听和自动滚动控制
    function initMouseActivityMonitor() {
        // 监听鼠标移动
        document.addEventListener('mousemove', function() {
            lastMouseTime = Date.now();

            // 如果自动滚动启用，则禁用它
            if (autoScrollEnabled) {
                autoScrollEnabled = false;
                console.log('检测到鼠标活动，自动滚动已关闭');
            }

            // 清除之前的定时器
            if (mouseTimer) {
                clearTimeout(mouseTimer);
            }

            // 设置15秒后重新启用自动滚动
            mouseTimer = setTimeout(() => {
                autoScrollEnabled = true;
                console.log('鼠标15秒未活动，自动滚动已启用');
                startAutoScroll();
            }, 15000);
        });

        // 监听滚动事件
        document.addEventListener('scroll', function() {
            if (autoScrollEnabled) {
                // 如果是自动滚动触发的，不做处理
                return;
            }

            // 用户手动滚动，重置鼠标活动时间
            lastMouseTime = Date.now();
        });
    }

    // 自动滚动功能
    function startAutoScroll() {
        if (!autoScrollEnabled) return;

        // 缓慢向下滚动
        const scrollStep = 1;
        const scrollInterval = 100; // 100ms滚动一次

        const autoScrollTimer = setInterval(() => {
            if (!autoScrollEnabled) {
                clearInterval(autoScrollTimer);
                return;
            }

            // 检查是否到达页面底部
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) {
                // 到达底部，滚动到顶部
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => {
                    if (autoScrollEnabled) {
                        startAutoScroll();
                    }
                }, 2000); // 等待2秒后重新开始滚动
                clearInterval(autoScrollTimer);
                return;
            }

            window.scrollBy(0, scrollStep);
        }, scrollInterval);
    }

    // 页面加载完成后创建悬浮窗
    window.addEventListener('load', () => {
        if (window.location.href.includes('182.92.8.169')) {
            // 随机延迟创建，避免固定时间特征
            setTimeout(() => {
                createFloatingWindow();
                // 初始化鼠标活动监听
                initMouseActivityMonitor();
                // 默认选择判断按钮
                setTimeout(() => {
                    const choiceButton = document.getElementById('choiceButton');
                    if (choiceButton) {
                        choiceButton.click();
                    }
                }, 100);
            }, getRandomDelay(500, 1500));
        }
    });
})();
