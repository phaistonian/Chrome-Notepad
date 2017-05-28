Options = {
    data		: localStorage['data'] ? JSON.parse(localStorage['data']) : {
        'options' : {
            'sync' 	: true,
            'size'	: 'm'
        }
    },

    initialize	: function() {
        if(!this.data.options) {
            this.data.options = {
                'sync' : true
            }
        }

        /* Sizes */
        this.data.options.fontSize	 = this.data.options.fontSize || '14px';
        this.data.options.fontFamily = this.data.options.fontFamily || 'default';
        this.data.options.size       = this.data.options.size || '300';


        if(this.data.options.fontSize) {
            this.select('font-size', this.data.options.fontSize);
        }


        if(this.data.options.fontFamily) {
            this.select('font-family', this.data.options.fontFamily);
        }

        if(this.data.options.size) {
            var numbered = Number(this.data.options.size);
            document.querySelector("#size").value =  (numbered > 600 || !numbered) ? 600 : numbered;
        }


        

        var btn = document.getElementById("saveBtn");
        btn.addEventListener("click", function() {
            Options.save();
        });

    },

    save : function() {
    
        var fontSize 	= document.getElementById('font-size');
        var fontFamily = document.getElementById('font-family');
        var size = document.getElementById('size');

        // Store
        //this.data 				= localStorage['data'] ? JSON.parse(localStorage['data']) : this.data;
        this.data.options.fontSize 		= fontSize.value;
        this.data.options.fontFamily    = fontFamily.value;
        this.data.options.size 	        = size.value || 300;

        localStorage['data']	= JSON.stringify(this.data);

        var say = document.getElementById('say');
        say.innerHTML 		= 'Saved';
        say.style.display	= 'inline';


        chrome.storage.sync.set({
            fontSize: fontSize.value,
            fontFamily: fontFamily.value,
            size : Number(size.value) > 600 ? 600 : Number(size.value)
        }, function() {
            setTimeout(function() {
                say.style.display = 'none';
            },3000);
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