'use strict';
// Keep the battlefield in view during the opening reveal; commands appear when ready.
(()=>{
 const choose=UI.chooseAction;UI.chooseAction=function(b){document.body.classList.remove('battle-arrival');return choose.call(UI,b)};
 const duo=UI.chooseDuoActions;UI.chooseDuoActions=function(b){document.body.classList.remove('battle-arrival');return duo.call(UI,b)};
 document.addEventListener('valga-screen',e=>{if(e.detail!=='scr-battle')document.body.classList.remove('battle-arrival')});
})();
