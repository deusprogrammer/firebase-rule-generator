import { useEffect, useState } from 'react';
import './App.css';

const authCheck = "request.auth != null";

const ruleTemplates = {
    type: (field) => `data.${field.name} is ${field.rules.type}`,
    regex: (field) => `data.${field.name}.matches('${field.rules.regex}')`,
    maxLength: (field) => `data.${field.name}.length <= ${field.rules.maxLength}`,
    minLength: (field) => `data.${field.name}.length >= ${field.rules.minLength}`,
    canBeEmpty: (field) => `data.${field.name} == ''`
}

const capitalize = (s) => {
    if (!s) {
        return '';
    }

    return s[0].toUpperCase() + s.slice(1);
}

const App = () => {
    let [schema, setSchema] = useState([]);
    let [rules, setRules] = useState("");

    const generateRules = () => {
        let rules = "";

        // Generate header
        rules += "rules_version = '2'\n";
        rules += "service cloud.firestore {\n"
        rules += "\tmatch /databases/{database}/documents {\n"
        
        // Generate validation functions
        rules += generateValidationFunctionBlock();

        // Generate rule blocks
        for (let model of schema) {
            rules += generateRuleBlock(model);
        }

        rules += "\t}\n";
        rules += "}";

        setRules(rules);
    }

    const generateRuleBlock = (model) => {
        let modelName = model.name;

        const functionName = `validate${capitalize(modelName)}Model(request.resource.data)`;
        const authCheckAndOwnerCheck = `${authCheck} && ownedByCaller(resource.data.${model.ownerField})`;
        let ruleBlock = "";

        ruleBlock += `\t\tmatch /${modelName}/{${modelName}Document} {\n`;
        ruleBlock += `\t\t\tallow read: if ${model.readAllAuthRequired ? authCheck : 'true'};\n`;
        ruleBlock += `\t\t\tallow create: if ${model.createAuthRequired ? authCheck : 'true'} && ${functionName};\n`;
        ruleBlock += `\t\t\tallow update: if ${model.updateAuthRequired ? authCheckAndOwnerCheck : 'true'} && ${functionName};\n`;
        ruleBlock += `\t\t\tallow delete: if ${model.deleteAuthRequired ? authCheckAndOwnerCheck : 'true'};\n`;
        ruleBlock += `\t\t}\n`;

        return ruleBlock;
    }

    const generateValidationFunctionBlock = () => {
        let ruleFunctions = "";

        ruleFunctions += "\t\tfunction ownedByCaller(ownerId) {\n";
		ruleFunctions += "\t\t\treturn\n";
		ruleFunctions += "\t\t\t\trequest.auth.uid == ownerId;\n";
		ruleFunctions += "\t\t}\n";

        for (let model of schema) {
            ruleFunctions += processModel(model) + "\n";
        }

        return ruleFunctions;
    }

    const processModel = (model) => {
        let ruleFunction = `\t\tfunction validate${capitalize(model.name)}Model(data) {\n\t\t\treturn`;
        let outerSep = "";
        for (let field of model.fields) {
            let sep = `${outerSep}\n\t\t\t`;
            for (let ruleName in field.rules) {
                if (ruleName === "type" && !["string", "number", "boolean", "object", "array"].includes(field.rules.type)) {
                    let subFunction = `validate${capitalize(field.rules.type)}Model(data.${field.name})`;
                    ruleFunction += `${sep} ${subFunction}`;
                    continue;
                }

                if (ruleName === "regex" && field.rules.canBeEmpty) {
                    ruleFunction += `${sep} (${ruleTemplates.canBeEmpty(field)} || ${ruleTemplates.regex(field)})`;
                    continue;
                }

                if (ruleName === "canBeEmpty") {
                    continue;
                }

                let transform = ruleTemplates[ruleName];
                let ruleValue = field.rules[ruleName];
                if (transform && ruleValue) {
                    ruleFunction += `${sep} ${transform(field)}`;
                    sep = " &&\n\t\t\t";
                }
            }
            outerSep = " &&";
        }
        ruleFunction += ";\n\t\t}";

        // ruleFunction += `\n\t\tfunction validate${capitalize(model.name)}ModelArray(data, n) {\n\t\t\treturn`;
        // ruleFunction += `\n\t\t\t\tvalidate${capitalize(model.name)}Model(data[n]) &&`;
        // ruleFunction += `\n\t\t\t\tvalidate${capitalize(model.name)}ModelArray(data, n+1)`
        // ruleFunction += ";\n\t\t}";

        return ruleFunction;
    }

    const addModel = () => {
        setSchema([...schema, {
            name: "model",
            fields: []
        }]);
    }

    const updateModel = (modelIndex, field, value) => {
        let schemaCopy = [...schema];
        let model = {...schema[modelIndex]};
        model[field] = value;
        schemaCopy[modelIndex] = model;

        setSchema(schemaCopy);
    }

    const addField = (modelIndex) => {
        let schemaCopy = [...schema];
        let model = {...schema[modelIndex]};
        model.fields.push({
            name: "newField",
            rules: {
                type: "string"
            }
        });
        schemaCopy[modelIndex] = model;
        setSchema(schemaCopy);
    }

    const updateField = (modelIndex, fieldIndex, rule, value) => {
        let schemaCopy = [...schema];
        let model = {...schema[modelIndex]};
        let field = {...model.fields[fieldIndex]};

        field.rules[rule] = value;
        model.fields[fieldIndex] = field;
        schemaCopy[modelIndex] = model;
        setSchema(schemaCopy);
    }

    const updateFieldName = (modelIndex, fieldIndex, newFieldName) => {
        if (!newFieldName) {
            newFieldName = "";
        }

        let schemaCopy = [...schema];
        let model = {...schema[modelIndex]};
        let field = {...model.fields[fieldIndex]};

        field.name = newFieldName;
        model.fields[fieldIndex] = field;
        schemaCopy[modelIndex] = model;
        setSchema(schemaCopy);
    }

    useEffect(() => {
        generateRules();
    }, [schema]);

    return (
        <div>
            <h1>Firebase Rule Generator</h1>
            <div className="generator-div">
                <div id="generator-form">
                    { schema.map((model, modelIndex) => {
                        return (
                            <div className="model">
                                <label>Collection</label>
                                <input value={model.name} onChange={({target: {value: newModelName}}) => {updateModel(modelIndex, "name", newModelName)}} />
                                <div className="field">
                                    <div>
                                        <input type="checkbox" onChange={({target: {checked}}) => {updateModel(modelIndex, "readAllAuthRequired", checked)}} checked={model.readAllAuthRequired} />
                                        <label>Read All Requires Auth</label>
                                    </div>
                                    <div>
                                        <input type="checkbox" onChange={({target: {checked}}) => {updateModel(modelIndex, "readOneAuthRequired", checked)}} checked={model.readOneAuthRequired} />
                                        <label>Read One Requires Auth</label>
                                    </div>
                                    <div>
                                        <input type="checkbox" onChange={({target: {checked}}) => {updateModel(modelIndex, "createAuthRequired", checked)}} checked={model.createAuthRequired} />
                                        <label>Create Requires Auth</label>
                                    </div>
                                    <div>
                                        <input type="checkbox" onChange={({target: {checked}}) => {updateModel(modelIndex, "deleteAuthRequired", checked)}} checked={model.deleteAuthRequired} />
                                        <label>Delete Requires Auth</label>
                                    </div>
                                    <div>
                                        <input type="checkbox" onChange={({target: {checked}}) => {updateModel(modelIndex, "updateAuthRequired", checked)}} checked={model.updateAuthRequired} />
                                        <label>Update Requires Auth</label>
                                    </div>
                                    <label>Owner Field</label>
                                    <select onChange={({target: {value}}) => {updateModel(modelIndex, "ownerField", value)}} value={model.ownerField} disabled={!model.updateAuthRequired && !model.deleteAuthRequired}>
                                        { model.fields.map(field => {
                                            return <option>{field.name}</option>
                                        })}
                                    </select>
                                </div>
                                { model.fields.map((field, fieldIndex) => {
                                    return (
                                        <div className="field"> 
                                            <label>Field Name</label>
                                            <input value={field.name} onChange={({target: {value: newFieldName}}) => {updateFieldName(modelIndex, fieldIndex, newFieldName)}} />
                                            <label>Type</label>
                                            <select onChange={({target: {value}}) => {updateField(modelIndex, fieldIndex, "type", value)}} value={field.rules.type}>
                                                <option>string</option>
                                                <option>number</option>
                                                <option>bool</option>
                                                <option>object</option>
                                                <option>array</option>
                                                { schema.map(model => <option>{model.name}</option>) }
                                            </select>
                                            <label>Regex</label>
                                            <input type="text" onChange={({target: {value}}) => {updateField(modelIndex, fieldIndex, "regex", value)}} value={field.rules.regex} />
                                            <label>Min Length</label>
                                            <input type="text" onChange={({target: {value}}) => {updateField(modelIndex, fieldIndex, "minLength", value)}} value={field.rules.minLength} />
                                            <label>Max Length</label>
                                            <input type="text" onChange={({target: {value}}) => {updateField(modelIndex, fieldIndex, "maxLength", value)}} value={field.rules.maxLength} />
                                            <div>
                                                <input type="checkbox" onChange={({target: {checked}}) => {updateField(modelIndex, fieldIndex, "canBeEmpty", checked)}} checked={field.rules.canBeEmpty} />
                                                <label>Can be empty</label>
                                            </div>
                                        </div>
                                    );
                                })}
                                <button onClick={() => {addField(modelIndex)}}>Add Field</button>
                            </div>
                        )
                    })}
                    <button onClick={addModel}>New Model</button>
                </div>
                <div id="generated-rules">
                    <h2>Rules</h2>
                    <pre>
                        {rules.replaceAll("\t", "  ")}
                    </pre>
                    <button onClick={() => {navigator.clipboard.writeText(rules.replaceAll("\t", "  "))}}>Copy</button>
                    <div></div>
                    <h2>Data</h2>
                    <pre>
                        {JSON.stringify(schema, null, 2)}
                    </pre>
                    <button onClick={() => {localStorage.setItem("firebaseSchema", JSON.stringify(schema))}}>Save</button>
                    <button onClick={() => {setSchema(JSON.parse(localStorage.getItem("firebaseSchema")))}} disabled={!localStorage.getItem("firebaseSchema")}>Load</button>
                </div>
            </div>
        </div>
    );
}

export default App;
