const toLines = str => {
	return str.replace(/\r\n/g,'\n').split('\n')
}

const getFileIndent = lines => {
	let tabs = 0;
	let spaces = 0;
	let indents = {};
	let last = 0;
	lines.map(line => {
		let leading = getLineIndent(line);
		let len = leading.length;
		if(len > 0){
			if(leading[0] == "\t") tabs++;
			else spaces++;
		}
		let diff = Math.abs(len - last);
		console.log(diff);
		last = len;
		if(diff != 0) indents[diff] = (indents[diff] || 0) + 1;
		
	})
	let max = 0;
	let num;
	for(key in indents){
		if(indents[key] > max) {
			max = indents[key];
			num = key;
		}
	}
	console.log(tabs);
	console.log(max);
	return (spaces >= tabs ? ' ':"\t").repeat(num)
};

const getLineIndent = line => {
	let match = /^(\s)*/.exec(line);
	return match ? match[0] : '';
}

const isUp = c => c.toUpperCase() == c;

const toSnake = pascal => {
  let parts = [];
  let current = '';
	let last = pascal.charAt(0);
	let save = () => { if(current != '') parts.push(current); }

  for(let c of (pascal.substr(1) + 'A')){
		if(isUp(last) && !isUp(c)){
			save()
			current = last.toLowerCase();
		} else if(!isUp(last) && isUp(c)){
			current = current + last.toLowerCase()
			parts.push(current);
			current = '';
		} else {
			current = current + last.toLowerCase()
		}
    last = c;
  }
	save()
	
  return parts.join('_')
}

const isCommentLine = line => /^\s*('''|""")\s*$/.test(line);

module.exports = { toLines, getFileIndent, getLineIndent, toSnake, isCommentLine }