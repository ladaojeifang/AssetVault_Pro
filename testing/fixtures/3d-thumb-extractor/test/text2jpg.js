const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

/**
 * 为纯文本文件生成纸张风格的缩略图
 * @param {string} inputFilePath - 输入的文本文件路径 (txt/json/md)
 * @param {string} outputImagePath - 输出的图片路径 (png)
 * @param {number} width - 缩略图宽度
 * @param {number} height - 缩略图高度
 */
function generateTextThumbnail(inputFilePath, outputImagePath, width = 256, height = 256) {
    const ext = path.extname(inputFilePath).toLowerCase();
    
    // 1. 极致性能读取：为了防止超大 JSON 卡死，我们只读取前 2KB
    let textContent = '';
    let fd = null;
    try {
        fd = fs.openSync(inputFilePath, 'r');
        const buffer = Buffer.alloc(2048);
        const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
        // 去除乱码字符，只保留可见文本
        textContent = buffer.toString('utf8', 0, bytesRead).replace(/\r/g, '');
    } catch (e) {
        textContent = "Error reading file content...";
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }

    // 2. 创建画布
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 3. 绘制透明或浅灰背景
    ctx.fillStyle = '#f5f5f5'; // 模拟资源管理器的背景色
    ctx.fillRect(0, 0, width, height);

    // 4. 绘制带有阴影的白纸
    const margin = 20; // 纸张距离边缘的留白
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff'; // 纸张颜色
    ctx.fillRect(margin, margin, width - margin * 2, height - margin * 2);

    // 绘制完白纸后，关掉阴影以免影响文字
    ctx.shadowColor = 'transparent'; 

    // 5. 绘制文件类型角标 (例如右上角或左上角)
    // 不同的格式给不同的颜色
    const badgeColors = {
        '.json': '#e3b505', // 黄色
        '.md': '#083fa1',   // 蓝色
        '.txt': '#666666'   // 灰色
    };
    ctx.fillStyle = badgeColors[ext] || '#666666';
    ctx.fillRect(margin, margin, 45, 20); // 画一个小色块
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(ext.replace('.', '').toUpperCase(), margin + 6, margin + 14);

    // 6. 绘制文本内容 (排版)
    ctx.fillStyle = '#333333';
    ctx.font = '12px "Consolas", "Courier New", monospace'; // 使用等宽代码字体
    const lineHeight = 18;
    let currentY = margin + 45; // 文本起始 Y 坐标

    // 按行分割文本
    const lines = textContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        // 如果文字写到了白纸底部，停止渲染以防止溢出
        if (currentY > height - margin - 15) {
            ctx.fillStyle = '#999999';
            ctx.fillText('...', margin + 15, currentY); // 底部加上省略号
            break;
        }

        // 简单的字符截断：防止单行代码过长超出纸张宽度
        let line = lines[i];
        const maxCharsPerLine = Math.floor((width - margin * 2 - 30) / 7); 
        if (line.length > maxCharsPerLine) {
            line = line.substring(0, maxCharsPerLine) + '…';
        }

        ctx.fillText(line, margin + 15, currentY);
        currentY += lineHeight;
    }

    // 7. 导出并保存为 PNG 图片
    const out = fs.createWriteStream(outputImagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    
    out.on('finish', () => {
        console.log(`✅ ${ext.toUpperCase()} 缩略图已生成: ${outputImagePath}`);
    });
}

// ====== 测试执行 ======
// 你可以先在同目录下建个 test.json 和 test.md，然后运行看看效果
generateTextThumbnail('./test.json', './thumb_json.png');
generateTextThumbnail('./test.md', './thumb_md.png');
generateTextThumbnail('./test.txt', './thumb_txt.png');