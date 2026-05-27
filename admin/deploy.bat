@echo off
chcp 65001 >nul
echo ====================================
echo   管理后台 - 一键部署到云存储
echo ====================================
echo.
echo 正在上传 index.html ...
tcb hosting deploy "%~dp0index.html" / -e cloud1-d7gvq0lhy78aa1507
echo.
if %errorlevel% equ 0 (
    echo [成功] 部署完成！等待1-2分钟缓存刷新后访问。
) else (
    echo [失败] 部署出错，请先运行 tcb login 登录。
)
echo.
pause
