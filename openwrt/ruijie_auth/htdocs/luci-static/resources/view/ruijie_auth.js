'use strict';
'require view';
'require fs';
'require ui';
'require form';

return view.extend({
	load: function() {
		return Promise.all([
			fs.read('/var/log/ruijie_auth.log').catch(function() { return ''; }),
			fs.exec('/etc/init.d/ruijie_auth', [ 'status' ]).then(function(res) {
				return (res.stdout || '').indexOf('running') >= 0;
			}).catch(function() { return false; })
		]);
	},

	render: function(data) {
		var m, s, o;
		var logdata = data[0], running = data[1];

		m = new form.Map('ruijie_auth', _('Ruijie Authentication'),
			_('Configure the Ruijie 802.1X EAP-MD5 authentication client.'));

		s = m.section(form.TypedSection, 'ruijie_auth');
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'interface', _('Interface'));
		o.default = 'eth0';

		o = s.option(form.Value, 'username', _('Username'));

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.placeholder = 'aa:bb:cc:dd:ee:ff';
		o.rmempty = true;

		o = s.option(form.Value, 'servers', _('Servers'));
		o.placeholder = '202.199.30.31;202.199.29.94';
		o.rmempty = true;
		o.description = _('Server addresses, separated by semicolon; leave empty for built-in default');

		o = s.option(form.Flag, 'dhcp', _('Run DHCP after success'));
		o.default = '0';

		o = s.option(form.Value, 'dhcp_cmd', _('DHCP command'));
		o.placeholder = 'udhcpc -i %I -n -q';
		o.rmempty = true;
		o.depends('dhcp', '1');

		var statusEl = E('span', {
			'id': 'ruijie-status',
			'style': 'font-weight:bold;color:' + (running ? '#2f8f46' : '#b00') + ';'
		}, running ? _('Running') : _('Stopped'));

		var statusSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-title' }, _('Status')),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, statusEl)
			])
		]);

		var actionsSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-title' }, _('Actions')),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, 'handleAction', 'start')
					}, _('Start')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-reset',
						'click': ui.createHandlerFn(this, 'handleAction', 'stop')
					}, _('Stop')),
					' ',
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.createHandlerFn(this, 'handleAction', 'restart')
					}, _('Restart')),
					' ',
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.createHandlerFn(this, 'refreshAll')
					}, _('Refresh'))
				])
			])
		]);

		var logSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-title' }, _('Log')),
			E('div', { 'class': 'cbi-section-descr' }, _('Recent authentication log output.')),
			E('div', { 'class': 'cbi-value' }, [
				E('pre', {
					'id': 'ruijie-log',
					'style': 'white-space:pre-wrap;word-break:break-all;max-height:400px;overflow:auto;background:#f7f7f7;padding:8px;font-family:monospace;'
				}, this.formatLog(logdata))
			])
		]);

		return m.render().then(function(node) {
			return E('div', {}, [ statusSection, actionsSection, node, logSection ]);
		});
	},

	formatLog: function(data) {
		var lines = (data || '').split('\n');
		while (lines.length && !lines[lines.length - 1])
			lines.pop();
		return lines.length ? lines.slice(-200).join('\n') : _('No log output yet.');
	},

	refreshAll: function() {
		var view = this;

		var statusP = fs.exec('/etc/init.d/ruijie_auth', [ 'status' ]).then(function(res) {
			var running = (res.stdout || '').indexOf('running') >= 0;
			var el = document.getElementById('ruijie-status');
			if (el) {
				el.textContent = running ? _('Running') : _('Stopped');
				el.style.color = running ? '#2f8f46' : '#b00';
			}
			return running;
		}).catch(function() {
			var el = document.getElementById('ruijie-status');
			if (el) {
				el.textContent = _('Stopped');
				el.style.color = '#b00';
			}
			return false;
		});

		var logP = fs.read('/var/log/ruijie_auth.log').catch(function() { return ''; }).then(function(data) {
			var el = document.getElementById('ruijie-log');
			if (el)
				el.textContent = view.formatLog(data);
		});

		return Promise.all([ statusP, logP ]);
	},

	handleAction: function(action) {
		var view = this;
		return fs.exec('/etc/init.d/ruijie_auth', [ action ]).then(function() {
			return view.refreshAll();
		});
	},

	handleSaveApply: function(ev, mode) {
		var view = this;
		return this.handleSave(ev).then(function() {
			return fs.exec('/etc/init.d/ruijie_auth', [ 'restart' ]);
		}).then(function() {
			return ui.changes.apply(mode == '0');
		}).then(function() {
			return view.refreshAll();
		});
	}
});
