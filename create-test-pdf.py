#!/usr/bin/env python3
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfutils
import sys

def create_test_pdf():
    # 创建PDF文件
    filename = "test-document.pdf"
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # 标题
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, height - 100, "PDF Document Text Extraction Test")
    
    # 内容
    c.setFont("Helvetica", 12)
    y_position = height - 150
    
    content_lines = [
        "This is a real PDF document created for testing.",
        "",
        "Features implemented today:",
        "1. Installed pdf-parse and mammoth dependencies",
        "2. Created extractDocumentText function", 
        "3. Modified GPT document processing logic",
        "",
        "Test content:",
        "- PDF document parsing test",
        "- Word document parsing test", 
        "- Multimodal AI integration verification",
        "",
        "This document will test our newly implemented",
        "document text extraction functionality.",
        "If GPT can read this content, our implementation",
        "is successful!"
    ]
    
    for line in content_lines:
        c.drawString(100, y_position, line)
        y_position -= 20
    
    # 保存PDF
    c.save()
    print(f"✅ PDF文件已创建: {filename}")

if __name__ == "__main__":
    try:
        create_test_pdf()
    except ImportError:
        print("❌ 需要安装reportlab库: pip3 install reportlab")
        sys.exit(1)
