Options = {
    data		: localStorage['data'] ? JSON.parse(localStorage['data']) : {
        'options' : {
            'sync' 	: true,
            'size'	: 'm'
        }
    },

    initialize	: function() {
        var sync = document.getElementById('sync');
        if(!this.data.options) {
            this.data.options = {
                'sync' : true
            }
        }

        /* Sizes */
        this.data.options.fontSize	= this.data.options.fontSize || '13px';
        this.data.options.fontFamily = this.data.options.fontFamily || '-webkit-body';


        if(this.data.options.fontSize) {
            this.select('font-size', this.data.options.fontSize);
        }


        if(this.data.options.fontFamily) {
            this.select('font-family', this.data.options.fontFamily);
        }


        if(this.data.options.sync) {
            sync.checked = true;
        }


        var btn = document.getElementById("saveBtn");
        btn.addEventListener("click", function() {
            Options.save();
        });

    },

    save : function() {
        var sync 	= document.getElementById('sync');
        var fontSize 	= document.getElementById('font-size');
        var fontFamily = document.getElementById('font-family');

        // Store
        //this.data 				= localStorage['data'] ? JSON.parse(localStorage['data']) : this.data;
        this.data.options.sync			= !!sync.checked;
        this.data.options.fontSize 		= fontSize.value;
        this.data.options.fontFamily 	= fontFamily.value;

        localStorage['data']	= JSON.stringify(this.data);

        var say = document.getElementById('say');
        say.innerHTML 		= 'Saved';
        say.style.display	= 'inline';


        chrome.storage.sync.set({
            fontSize: fontSize.value,
            fontFamily: fontFamily.value
        }, function() {
            setTimeout(function() {
                say.style.display = 'none';
            },2000);
        });

    },

    select	: function(what, value) {
        var select = document.getElementById(what);
        Array.prototype.slice.call(select.options).forEach(function(option, index) {
            if(option.value == value ) {
                select.selectedIndex = index;
            }
        });
    }

}



window.addEventListener('load', function() {
    Options.initialize();
});