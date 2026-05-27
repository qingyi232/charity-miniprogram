$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("F:\26dan\公益小程序\为老服务公益帮扶小程序志愿者端新增需求.docx")
$text = $doc.Content.Text
$doc.Close()
$word.Quit()
Write-Output $text
