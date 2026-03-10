> ⚠️ **Important Notice:** This platform, formerly known as **MEDomicsLab**, is now called **MEDomics**.

# MEDomics platform: Integrative Modeling of Heterogeneous Data in Medicine

<div align="center">
  <picture>
    <img
      width="200"
      src="./resources/MEDomicsNewLogo.png"
      alt="MEDomics logo white text"
    />
  </picture>
</div>

[![GitHub forks](https://img.shields.io/github/forks/MEDomics-UdeS/MEDomicsLab)]()
[![GitHub stars](https://img.shields.io/github/stars/MEDomics-UdeS/MEDomicsLab)]()
[![GitHub release](https://img.shields.io/github/release/MEDomics-UdeS/MEDomicsLab)]()
[![GitHub license](https://img.shields.io/github/license/MEDomics-UdeS/MEDomicsLab)](https://opensource.org/license/gpl-3-0)
[![Gitbook docs](https://img.shields.io/badge/GitBook-Documentation-lg?logo=gitbook&logoColor=white)](https://medomics-udes.gitbook.io/medomics-docs)
[![YouTube Channel](https://img.shields.io/badge/YouTube-Channel-red?logo=youtube&logoColor=white)](https://www.youtube.com/@MEDomicsLab)
[![Discord server](https://badgen.net/discord/members/ZbaGj8E6mP)](https://discord.com/invite/ZbaGj8E6mP)

## Table of Contents 
- [What is MEDomics?](#what-is-medomics)
- [MEDomics Overview](#medomics-overview)
- [MEDomics Components](#medomics-components)
- [MEDomics in Action](#medomics-in-action)
- [Installation and Usage](#installation-and-usage)
  - [Explore Documentation](#explore-documentation)
  - [Engage in MEDomics](#engage-in-medomics)
- [Acknowledgement](#acknowledgement)


## What is MEDomics?
**MEDomics** is an open-source platform designed to advance medical AI by bridging clinical and computational research. It empowers clinicians to design experiments, enables computer scientists to customize and adapt them, and refines processes with a flexible backend. The platform offers multiple usage levels: intuitive built-in pipelines, customizable settings, automatic code generation, and modular Python libraries—enhancing collaboration and innovation across healthcare professionals and data scientists.

## MEDomics Overview
The **MEDomics** platform is focused on integrative modeling of heterogeneous medical data to support personalized treatments. The platform offers an environment for manipulating  heterogeneous medical data and developing predictive models to enable the characterization 
of biological processes.

<div align="center">
  <picture width="600">
    <img
      width="600"
      src="./resources/Overview.png"
      alt="MEDomics overview"
    />
  </picture>
</div>

**The end-goal** is to give researchers the ability to leverage diverse 
data types contributing to more personalized and effective treatment models **by enhancing the synergy between computer scientists and clinical researchers**, in particular, through the code generation feature that allows for the automatic generation of Python code from the graphically created pipelines as depicted below.

<div align="center">
  <picture width="600">
    <img
      width="600"
      src="./resources/CodeGenerationFeature.png"
      alt="MEDomics code generation"
    />
  </picture>
</div>

## MEDomics Components

<div align="center">
  <picture width="600">
    <img
      width="600"
      src="./resources/Workflow.png"
      alt="MEDomics workflow"
    />
  </picture>
</div>

**MEDomics** uses a modular workflow, detailing how patient data is processed to develop and test predictive models for clinical use. The workflow consists of the following layers:

- **Design layer**: In this layer, various types of input data are integrated to support the analytical process. This includes DICOM images and tabular data in CSV format, such as time series and clinical text data from notes or reports. This layer uses the following modules:

  - [Extraction Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/design/extraction-modules): performs feature extraction to identify critical characteristics—like radiomic features from medical images using the [MEDimage package](https://medimage.app). 
  - [Input Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/design/input-module): used to process extracted data. It provides extensive functionalities including cleaning empty lines, merging tables, and removing correlated features. It also offers a tagging tool that allows users to organize dataset columns, and offers a graphical implementation of the [MEDprofiles package](https://github.com/MEDomics-UdeS/MEDprofiles) for patient data treatment and visualization.
  - [Exploratory Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/design/exploratory-module): utilized to assess data characteristics visually or statistically, with tools like [Sweetviz](https://github.com/fbdesignpro/sweetviz), [D-Tale](https://github.com/man-group/dtale), and [ydata-profiling](https://github.com/ydataai/ydata-profiling).

- **Development Layer**: Once features have been extracted and treated, it enters the Development Layer, which includes key modules for model training and testing:
  - [Learning Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/development/learning-module): allows users to experiment with different machine learning (ML) models to determine the best-performing algorithms for a given clinical endpoint. After model experimentation, the ML module can help finalize a model ready for evaluation and saves it under the MEDomics format: "*.medmodel*".
  - [Evaluation Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/development/evaluation-module): enables model validation by testing it on new data and explaining its performance and outcomes using the [explainerdashboard package](https://github.com/oegedijk/explainerdashboard). For models that require distributed data sources for training, a graphical implementation of the [MEDfl package](https://github.com/MEDomics-UdeS/MEDfl) for simulated Federated Learning (FL) is included, allowing users to simulate federated learning experiments.

- **Deployment Layer** : After finalizing and evaluating a model, it’s ready to be used in the [Application Module](https://medomics-udes.gitbook.io/medomics-docs/tutorials/deployment/application-module). This module enables users to apply the trained model to new datasets or patient data, making it accessible for clinical use. Additionally, the standardized "*.medmodel*" format plays a crucial role in facilitating collaboration, allowing models to be shared seamlessly across teams and ensuring compatibility and ease of integration in diverse environments.

## MEDomics in Action
Explore MEDomics's powerful features through the part two of the machine learning module tutorial. It highlights the intuitive interface and versatile tools available for data analysis and how it can be utilized.

<div align="center">
  <p><a href="https://youtu.be/9vcAkIaAcxE?si=p9QIpL2XjQTSIfJ3">
    <img
      width="600"
      src="./resources/LearningModuleTuto.png"
      ref
      alt="MEDomics learning tutorial part 2"
    />
  </a></p>
</div>

## Installation and Usage
[Get started here](https://medomics-udes.gitbook.io/medomics-docs/quick-start).

![Operating systems supported by MEDomics](./resources/OSSystemsSupport.png)

### Explore Documentation
Detailed documentation for MEDomics can be found 
[here](https://medomics-udes.gitbook.io/medomics-docs/).

### Engage in MEDomics
Explore our [contribution page](https://medomics-udes.gitbook.io/medomics-docs/contributing) for resources on contributing to the MEDomics platform and setting up your development environment.

<img src="./resources/ContributingTools.png"/>

## Acknowledgement

This project relies on the following open-source packages, and we are grateful to their developers:

<div align="center">
  <picture width="600">
    <img
      src="./resources/PackagesUsed-NoBG.png"
      alt="MEDomics workflow"
    />
  </picture>
</div>
