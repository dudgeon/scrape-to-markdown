import{S as a}from"./constants-I65fpLFJ.js";const r=`
(function() {
  try {
    var bd = window.boot_data || (window.TS && window.TS.boot_data);
    var token = bd && bd.api_token;
    if (token && typeof token === 'string' && token.startsWith('xoxc-')) {
      window.postMessage({ type: '__SLACK_COPIER_TOKEN__', token: token }, 'https://app.slack.com');
    }
  } catch(e) {}
})();
`;function i(){const e=new Blob([r],{type:"text/javascript"}),n=URL.createObjectURL(e),t=document.createElement("script");t.src=n,document.documentElement.appendChild(t),t.onload=()=>{t.remove(),URL.revokeObjectURL(n)},window.addEventListener("message",c=>{var s;if(c.origin!=="https://app.slack.com"||((s=c.data)==null?void 0:s.type)!=="__SLACK_COPIER_TOKEN__")return;const o=c.data.token;typeof o!="string"||!o.startsWith("xoxc-")||(chrome.storage.session.set({[a.TOKEN]:o}),chrome.runtime.sendMessage({type:"TOKEN_READY",token:o}).catch(()=>{}))})}function d(){const e=window.location.pathname.match(/\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i);return e?{workspaceId:e[1],channelId:e[2]}:null}function l(){let e=null;function n(){const t=d();t&&t.channelId!==e&&(e=t.channelId,chrome.storage.session.set({[a.CHANNEL_ID]:t.channelId,[a.WORKSPACE_ID]:t.workspaceId}),chrome.runtime.sendMessage({type:"CHANNEL_DETECTED",channelId:t.channelId,workspaceId:t.workspaceId}).catch(()=>{}))}n(),setInterval(n,2e3)}i();l();
