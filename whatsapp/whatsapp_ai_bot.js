const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

const client = new Client();
const threadMap = new Map(); // 存储联系人和线程ID的映射

// 假设的图片URLs
const imageUrls = {
    "F50🌈": "url_to_three_colors_of_F50_image",
    "F50📏": "url_to_size_chart_of_F50_image",
    "catalogo✨": "url_to_catalog_of_5_models_image",
    // ... 添加其他模型的图片URLs
};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    let threadId = threadMap.get(msg.from);

    if (!threadId) {
        // 创建对话线程
        const startResponse = await fetch('https://whatsapp-accelerator-assistant-2.k99qsm533.repl.co/start', { method: 'GET' });
        const startData = await startResponse.json();
        threadId = startData.thread_id;
        threadMap.set(msg.from, threadId);

        // 发送初始消息
        client.sendMessage(msg.from, 'hello');
    }

    // 发送用户的消息到 AI 助手
    const chatResponse = await fetch('https://whatsapp-accelerator-assistant-2.k99qsm533.repl.co/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, message: msg.body })
    });
    const chatData = await chatResponse.json();
    const runId = chatData.run_id;

    // 初始化尝试次数
    let attempts = 0;
    const maxAttempts = 10; // 最大尝试次数
    const waitTime = 2000; // 每次检查间隔时间（毫秒）

    // 定期检查 AI 助手的回复状态
    let completed = false;
    while (!completed && attempts < maxAttempts) {
        attempts++;
        const checkResponse = await fetch('https://whatsapp-accelerator-assistant-2.k99qsm533.repl.co/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_id: threadId, run_id: runId })
        });
        const checkData = await checkResponse.json();

        if (checkData.status === 'completed') {
            completed = true;

            // 检查回复中是否包含特定关键词
            const keywords = Object.keys(imageUrls);
            let imageUrlToSend = null;
            for (let i = 0; i < keywords.length; i++) {
                if (checkData.response.includes(keywords[i])) {
                    imageUrlToSend = imageUrls[keywords[i]];
                    break;
                }
            }

            // 发送 AI 回复
            client.sendMessage(msg.from, checkData.response || '无法获取回复');

            // 如果找到匹配的关键词，则发送相应的图片
            if (imageUrlToSend) {
                client.sendMessage(msg.from, imageUrlToSend);
            }
        } else if (checkData.status === 'in_progress') {
            // 如果仍在处理中，则等待一段时间后再次检查
            await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (checkData.response === 'timeout' && attempts >= maxAttempts) {
            client.sendMessage(msg.from, '超时，请稍后再试。');
            break; // 超时且尝试次数达到最大值时跳出循环
        }
    }

    if (!completed && attempts < maxAttempts) {
        client.sendMessage(msg.from, '处理中，请稍候...');
    }
});

client.initialize();
