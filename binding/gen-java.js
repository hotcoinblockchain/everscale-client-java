'use strict';

const api = require('./api.json');
const fs = require('fs');

const packageName = 'com.radiance.tonclient';
const reserved = ['public','private','protected','void','int','long','float','double','switch','case','return','new','class','interface','enum','try','catch','throw','throws'];

const PATH = './' + ('src.main.java.'+packageName).split('.').join('/') +'/';

let types = {};

var genFiles = require('./gen-files.json');
for(var f of genFiles) {
    if (fs.existsSync(PATH + f))
        fs.unlinkSync(PATH + f);
}

genFiles = [];

function dereserve(iden) {
    return (reserved.includes(iden)?'_':'') + iden;
}

const flatMap = (f,xs) =>
  xs.reduce((acc,x) =>
    acc.concat(f(x)), []);

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function camelize(s) {
    var arr = s.split('_');
    return dereserve(arr.shift() + arr.map(capitalize).join(''));
}

function htmlize(s) {
    return s&&s.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\s*\n/g, '<p>').replace(/\n/g,'').replace(/\[(.+)\]/g, (match,p1) => `<a target="_blank" href="${p1}">${p1}</a>`)||'';
}

function isFlattable(typeName) {
    let type = types[typeName];
    return type && type.isStruct && typeName.startsWith('ParamsOf');
}

function setTypeExported(field) {
    let type = types[field.type];
    if (type&&!type.isExported) {
        type.isExported = true;
        if (type.fields)
            type.fields.forEach(f => setTypeExported(f));
        //console.log(field.type);
    }
    return field;
}

function stringifyFields(fields, type) {
    let totLen = fields.length + (type?1:0);
    let stream = totLen > 1?'Stream.of(':'';
    return `"{${totLen?`"+${stream}${(type?[`"\\"type\\":\\"${type}\\""`]:[]).concat(fields.map(f=> {
        let qu = f.type == 'String'?'\\"':'';
        const flat = isFlattable(f.type);
        if (flat)
            return `"\\"${f.name}\\":"+${stringifyFields(types[f.type].fields)}`;
        return `(${camelize(f.name)}==null?${stream?'null':'""'}:("\\"${f.name}\\":${qu}"+${camelize(f.name)}${qu?`+"${qu}"`:''}))`;
    }))}${stream&&`).filter(_f -> _f != null).collect(Collectors.joining(","))`}+"`:''}}"`
}

function fieldMapper(f) {
    let field = {name: f.name||'value', desc: f.description, getType:() => ((!field.isRef)||(field.type in types&&types[field.type].isExported)?field.type:'Object') + (field.isArray?'[]':'')};
    while (true) {
        if (f.type == 'Optional') {
            f = f.optional_inner;
            field.isOptional = true;
        } else if (f.type == 'Array') {
            f = f.array_item;
            field.isArray = true;
        } else {
            if (f.type == 'Ref') {
                field.type = f.ref_name;
                field.isRef = true;
            } else
                field.type = f.type == 'BigInt'?'Long':f.type;
            break;
        }
    }
    return field;
}

api.modules.forEach(m => m.types.forEach(t => {
    let type = {};
    switch (t.type) {
        case 'Struct':
            type.fields = t.struct_fields.map(fieldMapper);
/*
                let field = {name: f.name, desc: f.description, getType:() => ((!field.isRef)||(field.type in types&&types[field.type].isExported)?field.type:'Object') + (field.isArray?'[]':'')};
                while (true) {
                    if (f.type == 'Optional') {
                        f = f.optional_inner;
                        field.isOptional = true;
                    } else if (f.type == 'Array') {
                        f = f.array_item;
                        field.isArray = true;
                    } else {
                        if (f.type == 'Ref') {
                            field.type = f.ref_name;
                            field.isRef = true;
                        } else
                            field.type = f.type == 'BigInt'?'Long':f.type;
                        break;
                    }
                }
                return field;
            });
*/            type.isStruct = true;
            break;
        case 'EnumOfConsts':
            type.fields = t.enum_consts.map(f => ({name:f.name, desc: f.desc, getType:()=>t.name}));
            type.isEnum = true;
            //type.isExported = true;
            break;
        case 'EnumOfTypes':
            console.log(t.name);
            type.variants = t.enum_types.map(v => ({name:v.name, desc:v.description, fields:v.struct_fields.map(fieldMapper)}));
            type.isEnumOfTypes = true;
        default:
            //console.log(t.type,t.name);
    }
    types[t.name] = type;
}));

api.modules.forEach(mod => {
    let imports = {'java.util.concurrent.CompletableFuture':true,'java.util.stream.*':true,'ton.sdk.TONContext':true};
    let body = '';

    mod.functions.forEach(f => {
        let rName = f.result.generic_args[0].ref_name;
        let rType = types[rName];
        let rField = {getType:()=>'Void'};
        //let rTypeName = 'Void';
        //let rFieldName = '';
        if (rType&&rType.fields.length > 1) {
            rType.isExported = true;
            //rTypeName = rName;
            rField = {getType:()=>rName}
        } else if (rType) {
            const f = rType.fields[0];
            //rTypeName = f.getType();
            //rFieldName = `.findValue("${f.name}")`;
            rField = f;
        }

        var event = f.params.length > 2?camelize('_'+f.name+'_event'):false;
        if (event)
            imports['java.util.function.Consumer'] = true;

        let fields = f.params.length > 1?types[f.params[1].ref_name].fields:[];
        let params = flatMap(f=> isFlattable(f.type)?types[f.type].fields:[f], fields)
            .map(p=> ({type:setTypeExported(p).getType(), name:camelize(p.name), desc:p.desc}));
        body += `   /**\n`;
        body += `    * ${htmlize(f.description)}\n    *\n`;
        body += params.map(p => `    * @param ${p.name} ${htmlize(p.desc)}\n`).join('');
        let rDesc = rField.desc || (((type)=>{return type&&type.desc})(types[rField.getType()]));
        if (rDesc)
            body += `    * @return ${rDesc}\n`;
        body += `    */\n`;
        body += `    public CompletableFuture<${rField.getType()}> ${camelize(f.name)}(${params.map(p=>p.type+' '+p.name).join(', ')}${event?`, Consumer<${event}> consumer`:''}) {\n`
        body += `        return context.requestJSON${event?'Callback':''}("${mod.name}.${f.name}", ${stringifyFields(fields)}${event?`, consumer, ${event}.class`:''})\n`;
        body += `            .thenApply(json -> TONContext.convertValue(json${rField.name?`.findValue("${rField.name}")`:''}, ${rField.getType()}.class));\n`;
        body += `    }\n\n`;
    });

    const className = capitalize(mod.name) + 'Module';
    genFiles.push(className + '.java');

    fs.writeFileSync(PATH + className + '.java', `package ${packageName};

${Object.keys(imports).map(i=>`import ${i};`).join('\n')}

/**
 *  ${htmlize(mod.description||'')}
 */
public class ${className} {

    private TONContext context;

    public ${className}(TONContext context) {
        this.context = context;
    }

${body}}
`);

});


Object.entries(types).filter(([n,t])=>t.isExported).forEach(([cName,t]) => {
    let genFunc;
    if (t.isEnum)
        genFunc = getEnumSource;
    else if(t.isEnumOfTypes) {
        genFunc = getEnumOfTypesSource;
    } else
        genFunc = getStructSource;
    if (genFunc) {
        genFiles.push(cName + '.java');
        fs.writeFileSync(PATH + cName + '.java', `package ${packageName};\n` + genFunc(cName,t));
    }
});

function getStructSource(cName, t, sClass) {
    
    return (!sClass?`
import java.util.stream.*;
import com.fasterxml.jackson.annotation.JsonProperty;
`:'')+`
/**
 *  ${htmlize(t.desc||'')}
 */
public ${sClass?'static ':''}class ${cName} ${sClass?`extends ${sClass} `:''}{
    public ${cName}() {
    }
${t.fields.filter(f=>f.name).length?`
    public ${cName}(${t.fields.filter(f=>f.name).map(f=>`${f.getType()} ${camelize(f.name)}`).join(', ')}) {
${t.fields.map(f=>`
        this.${camelize(f.name)} = ${camelize(f.name)};
`).join('')}
    }
`:''}

${t.fields.filter(f=>f.name).map(f=> {
    var arr = f.isArray?'[]':'';
    return `
    @JsonProperty("${f.name}")
    private ${f.getType()} ${camelize(f.name)};
    /**
     * ${htmlize(f.desc||'')}
     */
    public ${f.getType()} ${camelize('get_'+f.name)}() {
        return ${camelize(f.name)};
    }
    /**
     * ${htmlize(f.desc||'')}
     */
    public void ${camelize('set_'+f.name)}(${f.getType()} value) {
        ${camelize(f.name)} = value;
    }
`}).join('')}

    @Override
    public String toString() {
        return ${stringifyFields(t.fields.filter(f=>f.name), sClass&&cName)};
    }
}`
}

function getEnumSource(cName, t) {
    return `

/**
 *  ${htmlize(t.desc||'')}
 */
public enum ${cName} {
    ${t.fields.filter(f=>f.name).map(f=> f.name).join(',')}
}`
}

function getEnumOfTypesSource(cName, t) {
    return `
import java.util.stream.*;
import com.fasterxml.jackson.annotation.JsonProperty;

public abstract class ${cName} {
${t.variants.map(v => {
    
    return (v.fields.length?'':`
    public static final ${v.name} ${v.name} = new ${v.name}();
`) + getStructSource(v.name,v,cName);
}).join('\n')}
}`;
}

fs.writeFileSync('./gen-files.json', JSON.stringify(genFiles));

//Object.entries(types).filter(([n,t])=>t.isExported).forEach(([n,t])=>console.log(n));