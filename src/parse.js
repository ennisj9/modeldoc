const fs = require('fs');
const { toLines, getFileIndent, getLineIndent, isCommentLine } = require('./utility.js');

const stripComments = lines => {
	let comments = [];
	let currentComment;
	let currentReplace = '';
	let rest = [];
	lines.forEach(line => {
		if(isCommentLine(line)) {
			if(!currentComment) {
				currentReplace = RegExp('^'+getLineIndent(line));
				currentComment = [];
				comments.push(currentComment)
			} else currentComment = null;
		} else if(currentComment){
			currentComment.push(line.replace(currentReplace, ''))
		} else {
			rest.push(line)
		}
	});
	return {lines: rest, comments}
}

const classRegEx = /^(\s*)class ([^\(]+)\(.*\).*:/;

const isClassDefinition = line => {
	let res = classRegEx.exec(line)
	if(res) {
		return {
			indent: res[1],
			name: res[2]
		}
	}
	return false;
}

const tagRegEx = /^(Dict|List|Union|Optional)\[(.*)]$/
const typeAliases = {
	'[]': 'array',
	'list': 'array',
	'List': 'array',
	'{}': 'object',
	'dict': 'object',
	'Dict': 'object',
	'str': 'string',
	'int': 'integer',
	'float': 'float',
	'bool': 'boolean',
	'Any': 'any',
	'Optional': 'optional',
	'Union':'union'
}


const parseType = inp => {
	inp = inp.trim()
	let parts = tagRegEx.exec(inp);
	if(parts){
		let type = typeAliases[parts[1]];
		let args = parts[2].split(',').map(parseType)
		return { type, args }
	} else {
		return typeAliases[inp] || inp;
	}
}

const fieldRegEx = /(\w+)\s?:\s?([\w, \[\]]+)\s?(=[^#]*)?(#.*)?/

const parseField = line => {
	let trimmed = line.trim();
	if(trimmed == '' || trimmed.substr(0,3) == 'def') return;
	let parts = fieldRegEx.exec(trimmed);
	if(!parts) return;
	let field = {
		name: parts[1],
		type: parseType(parts[2]),
	};
	if(parts[3]) field.default = parts[3].substr(1).trim()
	if(parts[4]) field.comment = parts[4].substr(1).trim()
	return field;
}

const extractClasses = (lines, indent) => {
	let classes = [];
	let currentClass;
	lines.map(line => {
		if(currentClass){
			let lineIndent = getLineIndent(line);
			if(currentClass.indent + indent == lineIndent){
				let field = parseField(line)
				if(field) {
					currentClass.fields.push(field)
					currentClass.fieldsByName[field.name] = field
				}
			} else if(lineIndent.length <= currentClass.indent.length){
				currentClass = null;
			}
		} else {
			let cl = isClassDefinition(line);
			if(cl) {
				cl.fields = []
				cl.fieldsByName = {}
				currentClass = cl;
				classes.push(cl)
			}
		}
	})
	classes.map(cl => {
		delete cl.indent;
	})
	return classes;
}

const tagHeaderRegEx = /^\[[^\]\[]*\]$/

const parseCommentHeader = line => {
	line = line.trim()
    if(tagHeaderRegEx.test(line)){
		return line.slice(1,-1).split(',').map(s => s.trim())
	}
  let parts = line.split('->')
    .map(s => s.trim())
		.filter(s => s)
	if(parts.length == 2) {
    return {
      [parts[0]]: parts[1]
    }
	}
}

const parseComment = lines => {
	let comment = {
		name: lines.shift().trim(),
		body: [],
		tags: [],
		info: {}
	}

	let isHeader = true;
	lines.map(line => {
		if(isHeader){
			let parsedHeader = parseCommentHeader(line);
			if(parsedHeader){
				if(Array.isArray(parsedHeader)){
					comment.tags = parsedHeader;
				} else {
					Object.assign(comment.info, parsedHeader)
				}
			} else {
				isHeader = false;
				comment.body.push(line)
			}
		} else{
			comment.body.push(line)
		}
	})
	return comment;
}



const parseFile = async filename => {
	const file = await fs.promises.readFile(filename)
	let raw_lines = toLines(file.toString())
	let indent = getFileIndent(raw_lines)
	let { lines, comments } = stripComments(raw_lines)
	let classes = extractClasses(lines, indent)
	let fieldsByName = {}
	let classesByName = {}
	classes.map(cl => {
		classesByName[cl.name] = cl;
		Object.assign(fieldsByName, cl.fieldsByName)
	})
	comments.map(comment => {
		comment = parseComment(comment);
		let field = fieldsByName[comment.name];
		if(field){
			Object.assign(field, comment)
			return
		}
		let cl = classesByName[comment.name];
		if(cl) Object.assign(cl, comment)		
	})
	return classes;
}

module.exports = { parseFile }