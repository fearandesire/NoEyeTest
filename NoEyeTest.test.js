
function generateProgRange() {
let perStrings = []
	for (let per = 25; per <= 30; per++) {
		progRange = [per / 5 - 7, per / 4 - 1];
		progRange = progRange.map((value) => Math.round(value));
	perStrings.push(`${per}: [${progRange[0]} - ${progRange[1]}]`);
	}
	console.log(perStrings.join('\n'))
}

generateProgRange()