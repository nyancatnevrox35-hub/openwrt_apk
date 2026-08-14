'use strict';
'require view';
'require fs';
'require ui';
'require form';

return view.extend({
	load: function() {
		return fs.read('/var/log/ruijie_auth.log').catch(function() { return ''; });
	},

	render: function(logdata) {
		var m, s, o;

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

		o = s.option(form.Flag, 'dhcp', _('Run DHCP after success'));
		o.default = '0';

		o = s.option(form.Value, 'dhcp_cmd', _('DHCP command'));
		o.placeholder = 'udhcpc -i %I -n -q';
		o.rmempty = true;
		o.depends('dhcp', '1');

		var lines = (logdata || '').split('\n');
		while (lines.length && !lines[lines.length - 1])
			lines.pop();
		var logBody = lines.length ? lines.slice(-200).join('\n') : _('No log output yet.');

		var logSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-title' }, _('Log')),
			E('div', { 'class': 'cbi-section-descr' }, _('Recent authentication log output.')),
			E('div', { 'class': 'cbi-value' }, [
				E('pre', {
					'id': 'ruijie-log',
					'style': 'white-space:pre-wrap;word-break:break-all;max-height:400px;overflow:auto;background:#f7f7f7;padding:8px;font-family:monospace;'
				}, logBody)
			])
		]);

		var refreshBtn = E('button', {
			'class': 'btn cbi-button',
			'click': ui.createHandlerFn(this, 'handleRefresh')
		}, _('Refresh'));

		return E('div', {}, [ m.render(), logSection, refreshBtn ]);
	},

	handleRefresh: function() {
		fs.read('/var/log/ruijie_auth.log').catch(function() { return ''; }).then(function(data) {
			var lines = (data || '').split('\n');
			while (lines.length && !lines[lines.length - 1])
				lines.pop();
			var el = document.getElementById('ruijie-log');
			if (el)
				el.textContent = lines.length ? lines.slice(-200).join('\n') : _('No log output yet.');
		});
	}
});
