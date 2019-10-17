@echo off
setlocal

set ELECTRON_RUN_AS_NODE=

pushd %~dp0\..

:: Get Code.exe location
for /f "tokens=2 delims=:," %%a in ('findstr /R /C:"\"nameShort\":.*" product.json') do set NAMESHORT=%%~a
set NAMESHORT=%NAMESHORT: "=%
set NAMESHORT=%NAMESHORT:"=%.exe
set CODE=".build\electron\%NAMESHORT%"

:: Download Electron if needed
node build\lib\electron.js
if %errorlevel% neq 0 node .\node_modules\gulp\bin\gulp.js electron

:: Default to only running stable tests if test grep isn't set
if "%ADS_TEST_GREP%" == "" (
	echo Running stable tests only
	set ADS_TEST_GREP=@UNSTABLE@
	set ADS_TEST_INVERT_GREP=1
)

set CODE_ARGS=--grep %ADS_TEST_GREP%

if "%ADS_TEST_INVERT_GREP%" == "1" (
	set CODE_ARGS=%CODE_ARGS% --invert
) else if "%ADS_TEST_INVERT_GREP%" == "true" (
	set CODE_ARGS=%CODE_ARGS% --invert
)

:: Run tests
set ELECTRON_ENABLE_LOGGING=1
%CODE% .\test\electron\index.js %CODE_ARGS% %*

popd

endlocal
:: app.exit(0) is exiting with code 255 in Electron 1.7.4.
:: See https://github.com/Microsoft/vscode/issues/28582
echo errorlevel: %errorlevel%
if %errorlevel% == 255 set errorlevel=0
exit /b %errorlevel%
