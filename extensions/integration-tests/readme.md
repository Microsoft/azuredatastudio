This integration-tests suite is based on the extension testing feature provided by VS Code, We can use this for:
a.	Commands for setting up the environment for feature testing.
b.	Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

extensionInstallers folder: copy the VISX installers for the extensions we would like to run the tests with.
src folder: this is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

UI automation testing:
the ADS UI automation test cases should be added under $root/test/smoke/src/sql folder. Each feature should create its own folder and add 2 files, one for accessing the feature and the other for the test cases. For example: objectExplorer.ts and objectExplorer.test.ts. only tested on Windows for now.

Setup step:
1.	Launch ADS
2.	Install extensions from /extensions/integration-tests/extensionInstallers by calling the test command in the integration-tests extension
3.	Set configuration values. E.g. Enable preview features by calling the test command in the integration-tests extension

How to run the test:
1.	In the build pipeline:
The integration tests and UI automation tests have been added to ADS windows pipeline to run the test and report the results, you can find the test result under the test tab.

2.	Local environment:
Integration tests:
a. Install the python tool set required by Notebook, Open ADS and run command 'Configure Python for Notebooks' command and install it to the default folder, if you install it to a different folder you will have to update the setEnvironmentVariables.js to set it to your custom path. the environment variable name is ENVAR_PYTHON_INSTALL_PATH.
b. Open a terminal window/command line window.
c. navigate to this folder and then run 'node setEnvironmentVariables.js', please follow the instructions in the window: you will be prompted to login to azure portal.
d. navigate to the scripts folder and run sql-test-integration.bat or sql-test-integration.sh based on your environment.

UI automation tests:
navigate to test/smoke folder and run: node test/index.js
You can also run UI automation from VSCode by selecting the launch option: Launch Smoke Test.

ADS will be launched using new temp folders: extension folder and data folder so that your local dev environment won't be changed.


