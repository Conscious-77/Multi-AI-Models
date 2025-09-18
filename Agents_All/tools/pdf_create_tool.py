#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 PDF（支持中文 - 需安装 reportlab 且提供 TTF/OTF 中文字体）
- 从 stdin 读取 JSON: { title, content_markdown, output_path }
- 优先: 使用 reportlab + 外部字体渲染，支持中文
- 回退: 若依赖或字体缺失，使用最简 PDF（仅西文可见），并打印警告到 stderr
"""
import sys, json, os, textwrap

PAGE_WIDTH = 612  # 8.5in * 72
PAGE_HEIGHT = 792 # 11in * 72
MARGIN_LEFT = 50
MARGIN_TOP = 750
LINE_HEIGHT = 24
TITLE_FONT_SIZE = 20
BODY_FONT_SIZE = 12

FONTS_DIR = os.path.join(os.getcwd(), 'Agents_All', 'tools', 'fonts')
CANDIDATE_FONTS = [
    os.path.join(FONTS_DIR, 'NotoSansSC-Regular.otf'),
    os.path.join(FONTS_DIR, 'NotoSansSC-Regular.ttf'),
    os.path.join(FONTS_DIR, 'SourceHanSansSC-Regular.otf'),
    os.path.join(FONTS_DIR, 'SourceHanSansSC-Regular.ttf'),
    os.path.join(FONTS_DIR, 'SmileySans-Oblique.ttf'),
    os.path.join(FONTS_DIR, 'SmileySans-Oblique.otf'),
]


def find_font_path():
    for p in CANDIDATE_FONTS:
        if os.path.exists(p):
            return p
    return None


def render_with_reportlab(title: str, body: str, out_path: str):
    try:
        from reportlab.pdfgen import canvas
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception as e:
        raise RuntimeError('reportlab 未安装，请执行: python3 -m pip install --user reportlab')

    font_path = find_font_path()
    if not font_path:
        raise RuntimeError('未找到中文字体文件。请将 NotoSansSC-Regular.otf (或其他中文 TTF/OTF) 放到 Agents_All/tools/fonts 下。')

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    font_name = 'CJK'
    pdfmetrics.registerFont(TTFont(font_name, font_path))

    c = canvas.Canvas(out_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    c.setTitle(title)

    # 标题
    c.setFont(font_name, TITLE_FONT_SIZE)
    c.drawString(MARGIN_LEFT, MARGIN_TOP, title)

    # 正文
    y = MARGIN_TOP - LINE_HEIGHT * 2
    c.setFont(font_name, BODY_FONT_SIZE)

    # 简单折行
    body = body.replace('\r\n', '\n').replace('\r', '\n')
    lines = []
    for raw in body.split('\n'):
        wrapped = textwrap.wrap(raw, width=36) or ['']  # 36 个全角近似
        lines.extend(wrapped)
        lines.append('')  # 段落空行

    for line in lines:
        if y < 60:
            c.showPage()
            y = MARGIN_TOP
            c.setFont(font_name, BODY_FONT_SIZE)
        c.drawString(MARGIN_LEFT, y, line)
        y -= LINE_HEIGHT

    c.save()


# --- 最简PDF（无中文支持） ---

def escape_pdf_text(s: str) -> str:
    return s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')


def build_content_stream(title: str, body: str) -> bytes:
    lines = []
    lines.append('BT')
    lines.append('/F1 %d Tf' % TITLE_FONT_SIZE)
    lines.append(f'{MARGIN_LEFT} {MARGIN_TOP} Td')
    lines.append(f'({escape_pdf_text(title)}) Tj')

    y = MARGIN_TOP
    if body.strip():
        lines.append('/F1 %d Tf' % BODY_FONT_SIZE)
        lines.append(f'0 -{LINE_HEIGHT*2} Td')
        y -= LINE_HEIGHT*2
        raw_lines = body.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        for raw in raw_lines:
            sublines = textwrap.wrap(raw, width=90) or ['']
            for i, sub in enumerate(sublines):
                if i > 0:
                    lines.append(f'0 -{LINE_HEIGHT} Td')
                    y -= LINE_HEIGHT
                safe = escape_pdf_text(sub)
                lines.append(f'({safe}) Tj')
            lines.append(f'0 -{LINE_HEIGHT} Td')
            y -= LINE_HEIGHT
    lines.append('ET')
    content = '\n'.join(lines).encode('latin-1', errors='ignore')
    return content


def write_minimal_pdf(title: str, body: str, out_path: str):
    # 构建 5 个对象：Catalog, Pages, Page, Contents, Font(Helvetica)
    objects = []
    obj1 = b"<< /Type /Catalog /Pages 2 0 R >>"
    obj2 = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    content = build_content_stream(title, body)
    obj4 = b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream"
    obj3 = b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>" % (PAGE_WIDTH, PAGE_HEIGHT)
    obj5 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    objects = [obj1, obj2, obj3, obj4, obj5]

    out = []
    out.append(b"%PDF-1.4\n")

    def write_obj(num: int, data: bytes):
        out.append(f"{num} 0 obj\n".encode('ascii'))
        out.append(data)
        out.append(b"\nendobj\n")

    for i, obj in enumerate(objects, start=1):
        write_obj(i, obj)

    staged = b''.join(out)
    # 计算每个对象起始偏移
    starts = []
    for i in range(1, len(objects)+1):
        marker = f"{i} 0 obj\n".encode('ascii')
        pos = staged.find(marker)
        starts.append(pos)

    # 重新写入 xref 与 trailer
    head = staged
    xref = [b"xref\n", f"0 {len(objects)+1}\n".encode('ascii'), b"0000000000 65535 f \n"]
    for pos in starts:
        xref.append(f"{pos:010d} 00000 n \n".encode('ascii'))
    trailer = [b"trailer\n", f"<< /Size {len(objects)+1} /Root 1 0 R >>\n".encode('ascii'), b"startxref\n"]
    body = b''.join([head, *xref, *trailer])
    xref_pos = len(head)
    end = f"{xref_pos}\n%%EOF\n".encode('ascii')

    pdf_bytes = b''.join([body, end])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(pdf_bytes)


def main():
    try:
        data = json.load(sys.stdin)
        title = str(data.get('title', 'Untitled'))
        content = str(data.get('content_markdown', ''))
        out = data.get('output_path')
        if not out:
            raise ValueError('missing output_path')

        try:
            # 优先 reportlab + 中文字体
            render_with_reportlab(title, content, out)
        except Exception as e:
            sys.stderr.write('[warn] ' + str(e) + '\n')
            # 回退最简 PDF（无中文支持）
            write_minimal_pdf(title, content, out)
        return 0
    except Exception as e:
        sys.stderr.write(str(e))
        return 1

if __name__ == '__main__':
    sys.exit(main())
