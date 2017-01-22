Ext.initialize();

chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {
	if('req.update') {

		Ext.load();

		if(Ext.data.options.sync) {
			Ext.sync();
			Ext.syncTimer = setInterval((function() { Ext.sync()}), Ext.interval);
			console.log('sync')
		} else {
			if(Ext.syncTimer)	 {
				clearInterval(Ext.syncTimer);
			}
			console.log('unsync')
		}
	}
});