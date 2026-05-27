(function () {
  const $ = (id) => document.getElementById(id);
  window.lil.onOpenClawConfig((c) => {
    $('url').value = c.gatewayURL || '';
    $('token').value = c.authToken || '';
    $('prefix').value = c.sessionKeyPrefix || '';
    $('agent').value = c.agentId || '';
  });
  $('save').addEventListener('click', () => {
    window.lil.openclawSave({
      gatewayURL: $('url').value.trim() || 'ws://localhost:3001',
      authToken: $('token').value,
      sessionKeyPrefix: $('prefix').value.trim() || 'lil-agents',
      agentId: $('agent').value.trim() || null
    });
  });
  $('cancel').addEventListener('click', () => window.lil.openclawCancel());
})();
