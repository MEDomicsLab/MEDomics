# MEDomicsLab coding standards

## Table of contents

- [Recommended Software](#recommended-software)
- [Project Repository Structure](#project-repository-structure)
- [Style](#style)
- [Naming Conventions](#naming-conventions)
- [Components Structure](#components-structure)
- [Type Hinting](#type-hinting)
- [Syntax](#syntax)
- [Documentation](#documentation)
- [Python Coding Standard](#python-coding-standard)

## Recommended Software

- Windows (10 /11 +), macOs (12 +), Linux (20.04 +) [see electron app supported OS](https://www.electronjs.org/de/docs/latest/tutorial/unterst%C3%BCtzung#supported-versions)
- [Visual Studio Code](https://code.visualstudio.com/) extensions:
- [prettier & eslint](https://marketplace.visualstudio.com/items?itemName=rvest.vs-code-prettier-eslint) - code formatter standardizer (see [syntax](#syntax))
- Framework used in the platform
  - [npmjs](https://www.npmjs.com/) - Library manager for javascript language
  - [Electron](https://www.electronjs.org/) - Web based programming for standalone app developpement
  - [Nextjs](https://nextjs.org/) - Abstraction of [React](https://react.dev) adding server side rendering and optimisations
  - [Go](https://go.dev/) - Server side language

## Project Repository Structure

| Folder                              | Description                                           |
| ----------------------------------- | ----------------------------------------------------- |
| /app                                | Electron files                                        |
| /baseFiles                          | Empty base files                                      |
| /build                              | Contains distribution relative files                  |
| [/go_server](./go_server/README.md) | Contains Go code acting as a server                   |
| /main                               | Electron related contents                             |
| /node_modules                       | Contains saved libraries (created from `npm install`) |
| /pythonCode                         | Python code                                           |
| /pythonEnv                          | Python virtual environment utils                      |
| /renderer                           | NextJs related content                                |
| /resources                          | NextJs ressources (icons, etc.)                       |
| /utilScripts                        | NextJs ressources (icons, etc.)                       |

## Style

- Use [css react modules](https://create-react-app.dev/docs/adding-a-css-modules-stylesheet/)
- Import order (\_app.js)

```javascript
import  'bootstrap/dist/css/bootstrap.min.css';
import <all  other  global  css  libraries>
```

## Naming Conventions

### Javascript/react

- Component : PascalCase
- Component file name : camelCase
- Each file name should be the same as the component defined inside
- Component creation : prioritize function implementation over class

```javascript
export  default  const  myComponent = (someProps) =­> {
return (<></>)
}
```

- Function creation: prioritize arrow implementation

```javascript
const  myFct = (someParams) =­> {}
```

> See [react naming convention](https://www.upbeatcode.com/react/react-naming-conventions/)

## Components Structure

```bash
components
├───dataTypeVisualisation
│       dataTablePopoverBPClass.jsx
│       dataTableWrapper.jsx
│       dataTableWrapperBPClass.tsx
│
├───evaluation
│       dashboard.jsx
│       evaluationPageContent.jsx
│       pageConfig.jsx
│       pageEval.jsx
│       predictPanel.jsx
│
├───extractionImage
│   │   extractionJPG.jsx
│   │
│   └───extractionTypes
│           extractionDenseNet.jsx
│
├───extractionMEDimage
│   │   docLink.jsx
│   │   flowCanvas.jsx
│   │
│   ├───buttonsTypes
│   │       resultsButton.jsx
│   │       viewButton.jsx
│   │
│   └───nodesTypes
│       │   extractionNode.jsx
│       │   featuresNode.jsx
│       │   filterNode.jsx
│       │   segmentationNode.jsx
│       │   standardNode.jsx
│       │
│       ├───filterTypes
│       │       gaborFilter.jsx
│       │       lawsFilter.jsx
│       │       logFilter.jsx
│       │       meanFilter.jsx
│       │       waveletFilter.jsx
│       │
│       └───standardNodeForms
│               discretizationForm.jsx
│               inputForm.jsx
│               interpolationForm.jsx
│               reSegmentationForm.jsx
│
├───extractionTabular
│   │   extractionTabularData.jsx
│   │
│   └───extractionTypes
│           extractionBioBERT.jsx
│           extractionTSfresh.jsx
│
├───flow
│   │   btnDiv.jsx
│   │   codeEditor.jsx
│   │   errorRequestDialog.jsx
│   │   flowPageBase.jsx
│   │   groupNode.jsx
│   │   handlers.jsx
│   │   node.jsx
│   │   nodeWrapperResults.jsx
│   │   sidebarAvailableNodes.jsx
│   │   workflowBase.jsx
│   │
│   ├───context
│   │       flowFunctionsContext.jsx
│   │       flowInfosContext.jsx
│   │       flowResultsContext.jsx
│   │
│   └───results
│           pipelinesResults.jsx
│           resultsPane.jsx
│
├───generalPurpose
│       errorRequestContext.jsx
│       loaderContext.jsx
│       progressBarRequests.jsx
│
├───input
│       groupingTool.jsx
│       holdOutSetCreationTool.jsx
│       mergeTool.jsx
│       simpleCleaningTool.jsx
│       subsetCreationTool.jsx
│
├───layout
│   │   actionContext.jsx
│   │   iconSidebar.jsx
│   │   layoutContext.jsx
│   │   layoutManager.jsx
│   │
│   ├───flexlayout
│   │       mainContainerClass.tsx
│   │       popout.html
│   │       popupMenu.tsx
│   │       simple.layout
│   │       tabStorage.tsx
│   │       utils.tsx
│   │       zoomPanPinchComponent.jsx
│   │
│   └───sidebarTools
│       │   components.jsx
│       │   fileCreationBtn.jsx
│       │   recursiveChildrenTest.js
│       │
│       ├───directoryTree
│       │       renderItem.js
│       │       sidebarDirectoryTreeControlled.jsx
│       │       workspaceDirectoryTree.jsx
│       │
│       └───pageSidebar
│               evaluationSidebar.jsx
│               explorerSidebar.jsx
│               extractionSidebar.jsx
│               flowSceneSidebar.jsx
│               homeSidebar.jsx
│               inputSidebar.jsx
│               layoutTestSidebar.jsx
│               searchSidebar.jsx
│
├───learning
│   │   checkOption.jsx
│   │   input.jsx
│   │   modalSettingsChooser.jsx
│   │   workflow.jsx
│   │
│   ├───nodesTypes
│   │       datasetNode.jsx
│   │       loadModelNode.jsx
│   │       optimizeIO.jsx
│   │       selectionNode.jsx
│   │       standardNode.jsx
│   │
│   └───results
│       ├───node
│       │       analyseResults.jsx
│       │       dataParamResults.jsx
│       │       modelsResults.jsx
│       │       saveModelResults.jsx
│       │
│       └───utilities
│               dataTablePath.jsx
│               parameters.jsx
│
├───mainPages
│   │   application.jsx
│   │   evaluation.jsx
│   │   exploratory.jsx
│   │   extractionImage.jsx
│   │   extractionMEDimage.jsx
│   │   extractionText.jsx
│   │   extractionTS.jsx
│   │   home.jsx
│   │   htmlViewer.jsx
│   │   input.jsx
│   │   learning.jsx
│   │   modelViewer.jsx
│   │   output.jsx
│   │   results.jsx
│   │   terminal.jsx
│   │   test.jsx
│   │
│   ├───dataComponents
│   │       datasetSelector.jsx
│   │       dataTableFromContext.jsx
│   │       dataTableFromContextBP.jsx
│   │       dropzoneComponent.jsx
│   │       dropzoneComponent2.jsx
│   │       listBoxSelector.jsx
│   │       wsSelect.jsx
│   │
│   └───moduleBasics
│           modulePage.jsx
│           pageInfosContext.jsx
│
└───workspace
        dataContext.jsx
        newMedDataObject.js
        workspaceContext.jsx
```

> To generate this : ` tree .\renderer\components\ /f`

## Setup of [eslint](https://eslint.org/docs/latest/use/getting-started) and [prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Syntax

(ES6 for JS as mentionned by Electron, for Python Electron follows Chromium's Coding Style)

### Installation

- Install prettier and plugin (should be included in package.json so a `npm install` should do it)
  `npm install prettier
eslint-plugin-prettier eslint-config-prettier`
- Install [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions
- Open workspace settings
  - Can be accessed directly from this path: .vscode/settings.json
  - Or press `CTRL+SHIFT+P` and type `Preferences: Open Workspace Settings (JSON)`
- Add these lines

```javascript
{
  "eslint.options": {
    "overrideConfigFile": ".eslintrc.js"
  },
  "editor.formatOnSave": true,
  "eslint.validate": ["javascript"],
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Usage

There are 2 config files:

- eslint -­> .eslintrc.js
- prettier -> .prettierrc.js

A higher priority is placed on Prettier wich handles basic formatting

> see config file for more information on what it rules

then, all standards rules are placed in eslint config file.
So if you need to add specific rules, it should be in .eslintrc.js file

Use `CTRL+S` to save and format files.
Eslint may triggered error displayed as a red underline so you can hover these conventions error, then click on 'quick fix' and click on 'fix all/the problem(s)'

## Documentation

#### Docstring

```javascript
/**
* @param  {type}  someParams description
* @return  {type} description
* @description
* functionnal description of the function/React object
*/
const  myfct = (someParams) =­> {}
```

#### Comments

- Do not over detailed the code for readability
- Comments are meant to help understand important or critical actions in code

#### Documentation generation

> **Not tested** : https://www.npmjs.com/package/react-doc-generator

(Comments, docstrings, documentation generator...)

## Python Coding Standard

(see [MEDomicsTools for Python](https://github.com/MEDomics-UdeS/MEDomicsTools/blob/main/python.md))
