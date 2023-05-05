import blessed from "blessed";

function createForm(screen, config, { closable } = { closable: false }) {
	const form = blessed.form({
		name: 'form',
		screen: screen,
		keys: true,
		clickable: true,
		left: 'center',
		top: 'center',
		width: 53,
		height: config.height,
		shrink: false,
		border: 'line',
	});

	form.on('focus', () => form.screen.grabKeys = true);

	form.on('element keypress', (el, ch, key) => {
		if (key.name === 'enter' && el.type === 'textbox') {
			form.submit();
		}
	});

	form.on('keypress', (ch, key) => {
		if (key.name === 'enter') {
			form.submit();
		} else if (key.name === 'escape' && closable) {
			form.cancel();
		}
	});

	form.on('key q', () => {
		process.exit(0);
	});

	config.fields.forEach(field => {
		blessed.text({
			parent: form,
			left: field.label.left,
			bottom: field.label.bottom,
			align: 'left',
			content: field.label.content,
		});

		const textBox = blessed.textbox({
			parent: form,
			name: field.name,
			inputOnFocus: true,
			mouse: true,
			keys: true,
			height: 1,
			width: field.width,
			left: field.left,
			bottom: field.bottom,
		});

		if (field.censor) {
			textBox.censor = true;
		}

		field.ref = textBox;
	});

	config.buttons.forEach(button => {
		const btn = blessed.button({
			parent: form,
			mouse: true,
			keys: true,
			shrink: true,
			padding: {
				left: 1,
				right: 1,
			},
			left: button.left,
			bottom: button.bottom,
			content: button.content,
			style: {
				focus: {
					bg: 'grey',
				},
				hover: {
					bg: 'grey',
				},
			},
		});
		if (button.content === 'Cancel') {
			btn.on('press', () => form.cancel());
		} else if (button.content === 'Add') {
			btn.on('press', () => form.submit());
		} else {
			btn.on('press', () => button.action());
		}
	});

	return form;
}

export default function prompt(screen, config, { closable, message }) {
	let cancellation = Function.prototype;
	const promise = new Promise(function (fulfill, reject) {
		screen.saveFocus();
		screen.grabKeys = true;
		screen.grabMouse = true;

		const form = createForm(screen, config, { closable });

		let closed = false;
		function close_form() {
			closed = true;
			form.destroy();
			screen.restoreFocus();
			screen.grabKeys = false;
			screen.grabMouse = false;
			screen.render();
		}
		cancellation = () => {
			if (!closed) close_form();
		};

		form.on('submit', _ => {
			close_form();
			fulfill(config.fields.reduce((values, field) => {
				values[field.name] = field.ref.value;
				return values;
			}, {}));
		});

		form.on('cancel', () => close_form());

		screen.append(form);
		form.focus();
		form.grabMouse = true;
		screen.render();
	});
	return { promise, cancellation: () => cancellation() };
};

