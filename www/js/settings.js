/**
 * settings.js
 * Chaturveda Settings Manager
 *
 * Uses:
 * @capacitor/preferences
 * @capacitor-community/sqlite
 */


const ChaturvedaSettings = {


    defaults: {

        fontSize: "medium",

        fontFamily: "default",

        theme: "auto",

        lineHeight: "normal",

        pageMargin: "normal",

        justifyText: true,

        keepAwake: false,

        language: "বাংলা",

        script: "বাংলা",

        transliteration: false

    },





    async save(key,value){

        try{

            if(window.Capacitor?.Plugins?.Preferences){

                await window.Capacitor.Plugins.Preferences.set({

                    key:key,

                    value:String(value)

                });

            }

            else{

                localStorage.setItem(

                    "chaturveda_"+key,

                    value

                );

            }


        }

        catch(e){

            console.error(e);

        }

    },







    async get(key){


        try{


            if(window.Capacitor?.Plugins?.Preferences){


                const result =

                await window.Capacitor.Plugins.Preferences.get({

                    key:key

                });


                return result.value;


            }


            return localStorage.getItem(

                "chaturveda_"+key

            );


        }

        catch(e){

            return null;

        }

    },









    async loadAll(){


        const settings={};



        for(const key in this.defaults){


            let value =

            await this.get(key);



            if(value===null)

                value=this.defaults[key];



            if(value==="true")

                value=true;



            if(value==="false")

                value=false;



            settings[key]=value;


        }



        return settings;


    },








    async apply(){


        const s =

        await this.loadAll();



        const body=document.body;



        body.dataset.theme=s.theme;


        body.dataset.fontSize=s.fontSize;


        body.dataset.fontFamily=s.fontFamily;


        body.dataset.lineHeight=s.lineHeight;


        body.dataset.margin=s.pageMargin;





        if(s.justifyText)

            body.classList.add("justify-text");

        else

            body.classList.remove("justify-text");




        this.applyTheme(s.theme);



        return s;


    },









    applyTheme(theme){


        const root=document.documentElement;



        if(theme==="dark"){


            root.classList.add("dark");


        }


        else if(theme==="light"){


            root.classList.remove("dark");


        }


        else{


            if(

            window.matchMedia(

            "(prefers-color-scheme: dark)"

            ).matches

            )

                root.classList.add("dark");


        }


    },









    async setFontSize(value){

        await this.save(

            "fontSize",

            value

        );

        this.apply();

    },





    async setTheme(value){


        await this.save(

            "theme",

            value

        );


        this.apply();


    },







    async setReaderOption(

        key,

        value

    ){


        await this.save(

            key,

            value

        );


        this.apply();


    },










    async clearCache(){


        try{


            if(window.VedaLibrary){


                const manifest=

                await window.VedaLibrary.getManifest();



                for(const id in manifest){


                    await window.VedaLibrary.deleteBook(id);


                }


            }


            alert(

            "Cache cleared"

            );


        }


        catch(e){


            console.error(e);


        }


    },










    async getStorageUsage(){


        let size=0;


        if(navigator.storage){


            const estimate=

            await navigator.storage.estimate();


            size=estimate.usage || 0;


        }



        return size;


    },









    async keepScreenAwake(enable){


        await this.save(

            "keepAwake",

            enable

        );



        try{


            if(window.Capacitor?.Plugins?.KeepAwake){


                if(enable)

                    await window.Capacitor.Plugins.KeepAwake.keepAwake();


                else

                    await window.Capacitor.Plugins.KeepAwake.allowSleep();


            }


        }

        catch(e){


            console.log(e);


        }


    }


};





window.ChaturvedaSettings = ChaturvedaSettings;




// Apply saved settings when app starts

document.addEventListener(

"DOMContentLoaded",

()=>{

    ChaturvedaSettings.apply();

});
