exports.html = function(instruction) {
    let tag = instruction.Tag;
    let number = instruction.Number;
    let attribute = instruction.Attribute;
    let value = instruction.Value;
    let condition = instruction.Condition;
    let script = `
var atag = "${tag}".split("||");
var anumber = "${number}".split("||");
var aattribute = "${attribute}".split("||");
var avalue = "${value}".split("||");
var acondition = "${condition}".split("||");
var ascore = [];

for (let i = 0; i < atag.length; i++) {
    var tag = [];
    
    if (atag[i][0] == ".") {
        tag.push(document.getElementsByClassName(atag[i].slice(1)));
    } else {
        tag.push(document.getElementsByTagName(atag[i]));
    }
    
    if (document.getElementsByTagName("frame")) {
        let frames = document.getElementsByTagName("frame");
        for (let j = 0; j < frames.length; j++) {
            if (atag[i][0] == ".") {
                let ftag = frames[j].contentDocument.getElementsByClassName(atag[i].slice(1));
                tag.push(ftag);
            } else {
                let ftag = frames[j].contentDocument.getElementsByTagName(atag[i]);
                tag.push(ftag);
            }
        }
    }

    var number = anumber[i];
    var attribute = aattribute[i];
    var value = avalue[i];
    value = value.split(" ").join("");
    value = value.replace(/=/g, "\\\\");
    
    if (value != "*") {
        var re = new RegExp(value, "i");
        console.log(re.toString());
    }
    
    var condition = acondition[i];
    condition = condition.replace(/=/g, "\\\\");
    condition = condition.replace(/@/g, "'");

    if (condition != "*") {
        try {
            var exec = new Function(condition);
            exec();
        } catch (err) {
            console.log(err);
        }
    }

    var count = 0;
    for (let i = 0; i < tag.length; i++) {
        for (let j = 0; j < tag[i].length; j++) {
            if (attribute == "*") {
                if (value == "*") {
                    count++;
                    continue;
                }
            }
            if (tag[i][j].hasAttribute(attribute)) {
                if (value == "*" || re.test(tag[i][j].getAttribute(attribute).split(" ").join(""))) {
                    count++;
                    continue;
                }
            }
            if (tag[i][j][attribute]) {
                if (value == "*" || re.test(tag[i][j][attribute].split(" ").join(""))) {
                    count++;
                    continue;
                }
            }
        }
    }
    if (count >= number) {
        ascore.push(1);
    } else {
        ascore.push(0);
    }   
}
for (let i = 0; i < ascore.length; i++) {
    if (ascore[i] == 1) {
        scores.push(1);
        break;
    }
    if (i == ascore.length - 1) {
        scores.push(0);
        break;
    }
}
`
    return script;
}

exports.css = function(instruction) {
    let tag = instruction.Tag;
    let attribute = instruction.Attribute;
    let value = instruction.Value;
    let condition = instruction.Condition;
    let script = `
var atag = "${tag}".split("||");
var aattribute = "${attribute}".split("||");
var avalue = "${value}".split("||");
var acondition = "${condition}".split("||");
var ascore = [];

for (let i = 0; i < atag.length; i++) {
    
    var tag = atag[i];
    let styles = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
        styles.push(document.styleSheets[i].cssRules);
    }
    if (document.getElementsByTagName("frame")) {
        let frames = document.getElementsByTagName("frame");
        for (let j = 0; j < frames.length; j++) {
            if (frames[j].contentDocument.styleSheets.length != 0) {
                let style = frames[j].contentDocument.styleSheets[0].cssRules;
                styles.push(style);
            }
        }
    }


    var attribute = aattribute[i];
    var value = avalue[i];
    value = value.split(" ").join("");
    value = value.replace(/=/g, "\\\\");

    function standardize_color(str){
        var ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = str;
        return ctx.fillStyle;
    }

    if (/color/.test(attribute) && value != "*") {
        value = standardize_color(value.slice(1, value.length - 1));
    }
    
    if (value != "*") {
        var re = new RegExp(value, "i");
        console.log(re.toString());
    }
    
    var condition = acondition[i];
    condition = condition.replace(/@/g, "'");

    if (condition != "*") {
        try {
            var exec = new Function(condition);
            exec();
        } catch (err) {
            console.log(err);
        }
    }
    
    var count = 0;
    for (let i = 0; i < styles.length; i++) {
        for (let j = 0; j < styles[i].length; j++) {
            if (tag == "*" || styles[i][j].selectorText == tag) {
                if (styles[i][j].style[attribute] != "") {
                    let input = styles[i][j].style[attribute].split(" ").join("").replace(/^"+|"+$/g, '');
                    if (/color/.test(attribute)) {
                        input = standardize_color(input);
                    }
                    if (value == "*" || re.test(input)) {
                        count++;
                    }
                }
            }
        }
    }

    if (count == 0) {
        let elements = [];
        if (tag[0] == "*") {
            elements = document.getElementsByTagName(tag);
        } else if (tag[0] == ".") {
            elements = document.getElementsByClassName(tag.slice(1));
        } else if (tag[0] == "#") {
            elements.push(document.getElementById(tag.slice(1)));
        } else {
            elements = document.getElementsByTagName(tag);
        }
        for (let i = 0; i < elements.length; i++) {
            if (elements[i]) {
                let input = window.getComputedStyle(elements[i]).getPropertyValue(attribute).split(" ").join("").replace(/^"+|"+$/g, '');
                if (/color/.test(attribute)) {
                    input = standardize_color(input);
                }
                if (window.getComputedStyle(elements[i]).getPropertyValue(attribute) != "auto" && !(value == "*" && input == "rgba(0, 0, 0, 0)")) {
                    if (value == "*" || re.test(input)) {
                        count++;
                        continue;
                    }
                }
            }
        }
    }
    
    if (count > 0) {
        ascore.push(1);
    } else {
        ascore.push(0);
    }   
}
for (let i = 0; i < ascore.length; i++) {
    if (ascore[i] == 1) {
        scores.push(1);
        break;
    }
    if (i == ascore.length - 1) {
        scores.push(0);
        break;
    }
}
`
    return script;
}
exports.js = function(instruction) {
    let Key = instruction.Key;
    let Value = instruction.Value;
    let Lkey = instruction.Lkey;
    let Lvalue = instruction.Lvalue;
    let Nkey = instruction.Nkey;
    let Nvalue = instruction.Nvalue;
    let script = `

var ascore = [];

var akey = "${Key}".split("||");
var avalue = "${Value}".split("||");
var alkey = "${Lkey}".split("||");
var alvalue = "${Lvalue}".split("||");
var ankey = "${Nkey}".split("||");
var anvalue = "${Nvalue}".split("||");
for (let i = 0; i < akey.length; i++) {
    let scripts = [];
    for (let i = 0; i < document.getElementsByTagName("script").length; i++) {
        scripts.push(document.getElementsByTagName("script")[i].innerHTML);
    }
    if (document.getElementsByTagName("frame")) {
        let frames = document.getElementsByTagName("frame");
        for (let j = 0; j < frames.length; j++) {
            for (let k = 0; k < frames[j].contentDocument.getElementsByTagName("script").length; i++) {
                scripts.push(frames[j].contentDocument.getElementsByTagName("script")[i].innerHTML);
            }
        }
    }

    var key = akey[i];
    var value = avalue[i];
    value = value.split(" ").join("");
    value = value.replace(/ESC/g, "\\\\");
    if (value != "*") {
        var re = new RegExp(value, "i");
        console.log(re.toString());
    }

    var lkey = alkey[i];
    var lvalue = alvalue[i];
    lvalue = lvalue.split(" ").join("");
    lvalue = lvalue.replace(/ESC/g, "\\\\");
    if (lvalue != "*") {
        var lre = new RegExp(lvalue, "i");
        console.log(lre.toString());
    }

    var nkey = ankey[i];
    var nvalue = anvalue[i];
    nvalue = nvalue.split(" ").join("");
    nvalue = nvalue.replace(/ESC/g, "\\\\");
    if (nvalue != "*") {
        var nre = new RegExp(nvalue, "i");
        console.log(nre.toString());
    }
        
    var count = 0;
    var promises = [];

    for (let i = 0; i < scripts.length; i++) {
        let promise = new Promise((resolve, reject) => {
            socket.emit("tokenize", scripts[i], function(result) {
                for (let j = 0; j < result.length; j++) {
                    if (j == 0) {
                        if (result[j].type == key &&
                            lkey == "*" &&
                            result[j + 1].type == nkey) {  
                            let total = 0;
                            if (value == "*" || re.test(result[j].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (lvalue == "*") {
                                total++;
                            }
                            if (nvalue == "*" || nre.test(result[j + 1].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (total == 3) {
                                count++;
                            }
                        }
                    } else if (j == result.length - 1) {
                        if (result[j].type == key &&
                            result[j - 1].type == lkey &&
                            nkey == "*") {  
                            let total = 0;
                            if (value == "*" || re.test(result[j].value.replace(/^'+|'+$/g, ''))) {
                                    total++;
                            }
                            if (lvalue == "*" || lre.test(result[j - 1].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (nvalue == "*") {
                                total++;
                            }
                            if (total == 3) {
                                count++;
                            }
                        }
                    } else {
                        if (result[j].type == key &&
                            result[j - 1].type == lkey &&
                            result[j + 1].type == nkey) {  
                            let total = 0;
                            if (value == "*" || re.test(result[j].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (lvalue == "*" || lre.test(result[j - 1].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (nvalue == "*" || nre.test(result[j + 1].value.replace(/^'+|'+$/g, ''))) {
                                total++;
                            }
                            if (total == 3) {
                                count++;
                            }
                        }
                    }
                }
                resolve();
            });
        });
    
        promises.push(promise);
    }

    await Promise.all(promises);

    if (count > 0) {
        ascore.push(1);
    } else {
        ascore.push(0);
    }
}
for (let i = 0; i < ascore.length; i++) {
    if (ascore[i] == 1) {
        scores.push(1);
        break;
    }
    if (i == ascore.length - 1) {
        scores.push(0);
        break;
    }
}
`
    return script;
}
