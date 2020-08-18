const { toSnake } = require('./utility');
const Path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const renderMarkdowns = (classes, config) => {
	const output = Path.resolve(config.docDirectory,config.docModelDirectory)

	copyCss(config.docDirectory);

	filenames = {}

	classes.map(cl => {
		let filename = Path.resolve(output, toSnake(cl.name)+'.md');
		filenames[cl.name] = filename;
	})
	classes.map(cl => {
		let page = renderPage(cl, filenames, config);
		fs.writeFileSync(filenames[cl.name], page);
	})
	if(config.includeDependencies) renderDependencies(classes, config)
}

const copyCss = docDirectory => {
	fs.copyFileSync(Path.resolve(__dirname, './../assets/mkmodel.css'), Path.resolve(docDirectory+'css/mkmodel.css'))
}

const renderPage = (cls, filenames, config) => {
	page = 
		renderModelSection(cls, config)
		.concat(cls.fields.map(f => renderField(f,filenames, config)).flat())
		.join('\n')

	return page;
}

const linkModel = (model, config) => {
	return '['+model+'](/'+config.docModelDirectory+toSnake(model)+')';
}

const toSet = arr => Array.from(new Set(arr)).sort();

const renderModelSection = (cls, config) => {
	let lines = ['# '+cls.name, ''];
	if(cls.body) lines = lines.concat(cls.body);
	lines = lines.concat(renderInfo(cls.tags, cls.info))

	let featuredBy = cls.featuredBy.map(f => linkModel(f[1].name, config));
	let features = cls.features.map(f => linkModel(f[1].name, config));
	featuredBy = toSet(featuredBy);
	features = toSet(features);
	lines = lines.concat([
		'',
		'| Featured by | Features |',
		'| --- | --- |',
		'| ' +
			featuredBy.join('<br />') + ' | ' +
			features.join('<br />') + ' |',
		''
	])
	return lines;
}

const renderField = (field, filenames, config) => {
	let str = '## '+field.name;
	let key;
	if(field.comment){
		if(field.comment.indexOf('key:') == 0) {
			key = field.comment.substr(4).trim()
		}
	}
	if(field.type) {
		str += ' <span class="mkm-faint">:</span> ';
		str += renderType(field.type, filenames, key, config)
	}
	str+= '\n'; 
	let lines = renderInfo(field.tags, field.info, field.default)
	lines.unshift(str);
	lines = lines.concat(renderBody(field.body));
	lines.push('')
	return lines 
}

const renderType = (type, filenames, keyname, config) => {
	const rt = t => renderType(t, filenames, keyname, config);
	if(!type.type){
		let str = '<span class="mkm-type">';
		if(filenames[type]) str += linkModel(type, config);
		else str += type
		return str + '</span>';
	}
	if(type.type == 'object'){
		let key;
		if(keyname) key = 
			'<span class="mkm-keyname"><span class="mkm-recessed">&lt;</span>'
			+ keyname
			+'<span class="mkm-recessed">&gt;</span></span>'
		else key = rt(type.args[0])
		return '<span class="mkm-bracket">{</span> ' 
			+ key + ' : '
			+ rt(type.args[1]) 
			+ ' <span class="mkm-bracket">}</span>'
	} else if (type.type == 'array'){
		return '<span class="mkm-bracket">[</span> '
			+ rt(type.args[0])
			+ ' <span class="mkm-bracket">]</span>'
	} else if (type.type == 'union'){
		let str = '';
		type.args.forEach((arg, i) => {
			if(i != 0) str += ' <span class="mkm-or">or</span> '
			str += rt(arg);
		})
		return str;
	} else if (type.type == 'optional'){
		return rt(type.args[0])
			+ ' <span class="mkm-or">or</span> '+rt('null');
	}
}

const renderInfo = (tags, info, def) => {
	if((!tags || tags.length <= 0) && 
		(!info || Object.keys(info) <= 0 ) &&
		!def){
			return [];
	}
	let lines = ['<div class="mkm-info">'];
	if(tags && tags.length > 0) {
		lines.push('<div class="mkm-info-tags">')
		tags.map(tag => {
			lines.push('<span class="mkm-info-tag">'+tag+'</span>')
		})
		lines.push('</div>')
	}
	info = info || {};
	let infoKeys = Object.keys(info);
	if(def) {
		info.default = '<code>'+def+'</code>'
		infoKeys.unshift('default');
	}
	if(Object.keys(info).length > 0 ) {
		infoKeys.map(key => {
			lines = lines.concat([
				'<div class="mkm-info-pair">',
				'<div class="mkm-info-key">'+key+'</div>',
				'<div class="mkm-info-value">'+info[key]+'</div>',
				'</div>'
			])
		});
	}
	lines.push('</div>')
	return lines;
}

const renderBody = lines => {
	return lines ? lines : [];
}

const ensureYamlListItem = (list, label, val) => {
	let index = -1;
	for(let i = 0; i< list.length; i++){
		if(list[i] == label || list[i][label]) {
			index = i;
			break;
		}
	}
	let item = val === undefined ? label : {[label]: val};
	if(index >= 0) list[index] = item;
	else list.push(item);
}

const writeMkdocsConfig = (classes, config) => {
	let mkconfig;
	let output = config.mkdocsFile
	try{
		mkconfig = yaml.load(fs.readFileSync(config.mkdocsFile).toString());
	} catch(e){
		console.log('Could not load mkdocs file: ' + config.mkdocsFile)
		mkconfig = {};
		output = config.mkdocsFile.replace('.yml','') + '_nav.yml'
	}
	let modelBin = [];
	if(!mkconfig.nav) mkconfig.nav = [];
	classes.map(cl => {
		modelBin.push({[cl.name]: config.docModelDirectory + toSnake(cl.name)+'.md'})
	})
	ensureYamlListItem(mkconfig.nav, config.navFolder, modelBin);
	if(config.includeDependencies) ensureYamlListItem(mkconfig.nav, config.dependenciesTitle, 'model_dependencies.md');
	if(!mkconfig.extra_css) mkconfig.extra_css = [];
	ensureYamlListItem(mkconfig.extra_css, 'css/mkmodel.css');

	fs.writeFileSync(output, yaml.dump(mkconfig, {noArrayIndent: true}))
	console.log('Mkdocs config written to '+output)

}

const renderDependencies = (classes, config) => {
	let page = `# ${config.dependenciesTitle}\n<div />`;
	let roots = classes.filter(cl => cl.featuredBy.length <= 0);
	
	const renderClass = cl => {
		let str = 
			'<span class="mkm-depclass">'+linkModel(cl.name, config)+'</span>\n'
			+ '<div class="mkm-depblock">\n';
		cl.features.map(feature => {
			str += feature[0] + ' : ' + renderClass(feature[1]);
		})
		let missing = cl.fields.length - cl.features.length;
		if(cl.features.length > 0 && missing > 1) {
			str += '<span class="mkm-missing">' + missing + ' other field(s)</span>';
		}
		str += '</div>\n';
		return str;
	}
	
	roots.sort((a, b) => a.features.length > b.features.length)
	roots.map(root => {
		page += '<div>' + renderClass(root) + '</div>'+'<br />'

	});
	
	fs.writeFileSync(config.docDirectory + 'model_dependencies.md', page);
	
}


module.exports = { renderMarkdowns, writeMkdocsConfig }