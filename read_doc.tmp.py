import docx

doc = docx.Document(r'F:\26dan\公益小程序\为老服务公益帮扶小程序整体设计方案.docx')
with open(r'f:\26dan\公益小程序\design_spec.tmp.txt', 'w', encoding='utf-8') as f:
    for para in doc.paragraphs:
        if para.text.strip():
            f.write(para.text + '\n')
print('Done')
