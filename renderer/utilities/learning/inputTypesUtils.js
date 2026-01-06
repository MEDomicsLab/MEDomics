// this function returns the default value of a setting according to its type and a list of all the implemented types
const createConstants = () => {
  let defaultValue = {}
  let implementedTypes = []
  implementedTypesDescription.map((typeInfo) => {
    defaultValue[typeInfo.type] = typeInfo.default
    implementedTypes.push(typeInfo.type)
  })
  return {
    defaultValueFromType: defaultValue,
    implementedTypes: implementedTypes
  }
}

// list of implemented types
// **IMPORTANT** if you want to add a new type, you have to add it here.
const implementedTypesDescription = [
  {
    type: "string",
    description: "for normal string input",
    default: ""
  },
  {
    type: "int",
    description: "for integer input",
    default: 0
  },
  {
    type: "float",
    description: "for float input",
    default: 0.0
  },
  {
    type: "bool",
    description: "for boolean input (form select of 2 options True/False)",
    default: false
  },
  {
    type: "list",
    description: "for list input (form select of all the options)",
    default: (optionsList) => {
      return optionsList[0]
    }
  },
  {
    type: "list-multiple",
    description: "for list input (form select of all the options, multiple selection possible)",
    default: () => {
      return []
    }
  },
  {
    type: "list-multiple-columns",
    description: "for list input (form select of all the options, multiple selection possible)",
    default: () => {
      return []
    }
  },
  {
    type: "range",
    description: "for range input",
    default: (min, max) => {
      return min
    }
  },
  {
    type: "custom-list",
    description: "for custom list input (multiple custom string inputs)",
    default: () => {
      return []
    }
  },
  {
    type: "pandas.DataFrame",
    description: "for pandas dataframe input",
    default: () => {
      return []
    }
  },
  {
    type: "data-input",
    description: "for data input (file upload)",
    default: { name: "No selection", path: "" }
  },
  {
    type: "data-input-multiple",
    description: "for data input (file upload)",
    default: []
  },
  {
    type: "models-input",
    description: "for data input (file upload)",
    default: { name: "No selection", path: "" }
  },
  {
    type: "tags-input-multiple",
    description: "for tags input",
    default: []
  },
  {
    type: "variables-input-multiple",
    description: "for variables input",
    default: []
  },
  {
    type: "str or None",
    description: "for str or None input",
    default: ""
  },
  {
    type: "bool-int-str",
    description: "bool-int-str",
    default: ""
  },
  {
    type: "int-float-str",
    description: "int-float-str",
    default: ""
  },
  {
    type: "dataframe",
    description: "for dataframe input",
    default: ""
  },
  {
  type: "multi",
  description: "Generic type supporting multiple possible input types",
  default: null
}
]

// this object is used to get the default value and implemeted types of possible settings
const { defaultValueFromType, implementedTypes } = createConstants()

export { defaultValueFromType, implementedTypes }
