import { useEffect, useState } from 'react';
import './App.css';

const schemaFieldTemplates = {
    type: (field, fieldSchema) => `request.resource.data.${field} is ${fieldSchema.type}`,
    regex: (field, fieldSchema) => `request.resource.data.${field}.matches('${fieldSchema.regex}')`,
    maxLength: (field, fieldSchema) => `request.resource.data.${field}.length <= ${fieldSchema.maxLength}`,
    minLength: (field, fieldSchema) => `request.resource.data.${field}.length >= ${fieldSchema.minLength}`
}

const capitalize = (s) => {
    return s[0].toUpperCase() + s.slice(1);
}

const App = () => {
    let [schema, setSchema] = useState({});
    let [schemaJson, setSchemaJson] = useState("");
    let [rules, setRules] = useState("");

    const generateRules = () => {
        let rules = "";
        rules += generateValidationFunctionBlock();
        for (let modelName in schema) {
            rules += generateRuleBlock(modelName) + "\n";
        }

        setRules(rules);
    }

    const generateRuleBlock = (modelName) => {
        let functionName = `validate${capitalize(modelName)}Model()`;
        return `
match /${modelName}/{${modelName}Document} {
    allow create: if ${functionName};
    allow update: if ${functionName} && ownedByCaller();
    allow delete: if ownedByCaller();
    allow read: if true;
}
        `
    }

    const generateValidationFunctionBlock = () => {
        let ruleFunctions = "";
        for (let modelName in schema) {
            let modelSchema = schema[modelName];
            ruleFunctions += processModel(modelName, modelSchema) + "\n\n";
        }

        return ruleFunctions;
    }

    const processModel = (modelName, modelSchema) => {
        let ruleFunction = `function validate${capitalize(modelName)}Model() {\n\treturn`;
        let outerSep = "";
        for (let field in modelSchema) {
            let fieldSchema = modelSchema[field];
            let sep = `${outerSep}\n\t\t`;
            for (let fieldSchemaAttribute in fieldSchema) {
                let transform = schemaFieldTemplates[fieldSchemaAttribute];
                if (transform) {
                    ruleFunction += `${sep} ${transform(field, fieldSchema)}`;
                    sep = " &&\n\t\t";
                }
            }
            outerSep = " &&";
        }
        ruleFunction += ";\n}";

        return ruleFunction;
    }

    useEffect(() => {
        generateRules();
    }, [schema]);

    return (
        <div className="generator-div">
            <div id="generator-form">
                <label>Object Schema</label>
                <textarea onChange={({target: {value}}) => {setSchemaJson(value)}} onkeydown="if(event.keyCode===9){var v=this.value,s=this.selectionStart,e=this.selectionEnd;this.value=v.substring(0, s)+'\t'+v.substring(e);this.selectionStart=this.selectionEnd=s+1;return false;}"></textarea>
                <button onClick={() => {setSchema(JSON.parse(schemaJson))}}>Generate</button>
            </div>
            <div id="generated-rules">
                <pre>
                    {rules.replaceAll("\t", "  ")}
                </pre>
            </div>
        </div>
    );
}

export default App;
