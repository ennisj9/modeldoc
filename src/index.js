const fs = require('fs');
const Path = require('path');
const yaml = require('js-yaml');

const { renderMarkdowns, writeMkdocsConfig } = require('./render')
const { parseFile } = require('./parse')

const config = {
	inputDirectory: 'models/',
	docDirectory: 'docs/',
	docModelDirectory: 'models/',
	navFolder: 'Models',
	mkdocsFile: 'mkdocs.yml',
	includeDependencies: true,
	dependenciesTitle: 'Model dependencies',
	outputFile: null
}

try {
	let confFile = fs.readFileSync('modeldoc.yml').toString();
	let conf = yaml.load(confFile);
	for(let key in conf){
		if(!config[key]) console.log('Unrecognized key "'+key+'" in modeldoc.yml')
	}
	Object.assign(config, conf);
}
catch(e) {
	console.log('No modeldoc.yml config file loaded.')
}

const save = (obj, file) => {
	fs.writeFileSync(file, JSON.stringify(obj, null, '  '))
}

const prepareDirectories = config => {
	let css = config.docDirectory + 'css/';
	let models = config.docDirectory + config.docModelDirectory;
	let dirs = [css, models];
	
	dirs.map(dir => {
		let parts = dir.split(/\/|\\/);
		let agg = ''
		parts.map(part => {
			if(part == '') return;
			try{
				fs.mkdirSync(agg + part);
			}
			catch(e) {
			}
			agg += part + '/';
		})
	})
}

const establishRelationships = classes => {
	let byName = {}
	classes.map(cl => {
		byName[cl.name] = cl;
		cl.features = [];
		cl.featuredBy = [];
	});
	classes.map(cl => {
		const visitType = (field, type) => {
			if(type.type) type.args.map(a => visitType(field, a))
			else if(byName[type]) {
				byName[type].featuredBy.push([field, cl])
				cl.features.push([field, byName[type]])
			}
		}
		cl.fields.map(field => {
			visitType(field.name, field.type)
		})
	})
}

const run = async () => {
	let input = Path.resolve(config.inputDirectory);
	const files = await fs.promises.readdir(input)
	let allClasses = []
	for(let i = 0; i < files.length; i++){
		let file = files[i];
		if(file.indexOf('.py') < 0) continue;
		let classes = await parseFile(Path.join(input, file))
		classes.map(cl => allClasses.push(cl))
	}
	if(config.outputFile){
		save(allClasses, config.outputFile)
	}
	prepareDirectories(config);
	establishRelationships(allClasses);
	renderMarkdowns(allClasses, config)
	writeMkdocsConfig(allClasses, config)
}
run()
.catch(e => {
	console.log(e)
})
