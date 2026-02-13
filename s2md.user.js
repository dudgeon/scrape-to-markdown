// ==UserScript==
// @name         scrape-to-markdown (s2md)
// @namespace    https://github.com/dudgeon/scrape-to-markdown
// @version      0.1.0
// @description  Export Slack conversations as clean markdown
// @author       dudgeon
// @match        https://app.slack.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      slack.com
// @updateURL    https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js
// @downloadURL  https://raw.githubusercontent.com/dudgeon/scrape-to-markdown/main/s2md.user.js
// ==/UserScript==

(function(){"use strict";const me="https://slack.com/api",L={USER_CACHE:"user_display_name_cache",TEMPLATES:"frontmatter_templates"},I=1e3,U=200;let A,H;function he(e,t){A=e,H=t}async function $(e,t){const n=await A.getToken();if(!n)throw new Error("No token available. Open Slack and refresh the page.");const r=await A.getCookie();if(!r)throw new Error("No session cookie found. Make sure you are logged into Slack.");const a=await(await H.post(`${me}/${e}`,{Authorization:`Bearer ${n}`,Cookie:r,"Content-Type":"application/x-www-form-urlencoded"},new URLSearchParams(t).toString())).json();if(!a.ok)throw a.error==="invalid_auth"||a.error==="token_revoked"?(await A.clearToken(),new Error("AUTH_EXPIRED")):new Error(`Slack API error: ${a.error}`);return a}function B(e){return new Promise(t=>setTimeout(t,e))}async function ge(e,t={}){var f,l;const n=[];let r;const s=t.limit;let a=0,o=0;do{const g=s?Math.min(U,s-a):U,c={channel:e,limit:String(g),inclusive:"true"};t.oldest&&(c.oldest=t.oldest),t.latest&&(c.latest=t.latest),r&&(c.cursor=r);const m=await $("conversations.history",c);if(n.push(...m.messages),a+=m.messages.length,r=((f=m.response_metadata)==null?void 0:f.next_cursor)||void 0,o++,(l=t.onPage)==null||l.call(t,o),s&&a>=s)break;r&&await B(I)}while(r);return n.reverse(),s&&n.length>s?n.slice(n.length-s):n}async function _e(e,t){var s;const n=[];let r;do{const a={channel:e,ts:t,limit:String(U)};r&&(a.cursor=r);const o=await $("conversations.replies",a);n.push(...o.messages),r=((s=o.response_metadata)==null?void 0:s.next_cursor)||void 0,r&&await B(I)}while(r);return n}async function W(e){var r,s;const n=(await $("conversations.info",{channel:e})).channel;return{id:n.id,name:n.name,is_channel:n.is_channel,is_group:n.is_group,is_im:n.is_im,is_mpim:n.is_mpim,is_private:n.is_private,topic:((r=n.topic)==null?void 0:r.value)||"",purpose:((s=n.purpose)==null?void 0:s.value)||""}}async function be(){const e=await $("team.info",{});return{name:e.team.name,domain:e.team.domain}}async function ye(e){const t=await $("users.info",{user:e}),n=t.user.profile;return{displayName:n.display_name||n.real_name||t.user.real_name||e}}let Y,T={},Z=!1;function we(e){Y=e}async function ke(){Z||(T=await Y.get(L.USER_CACHE)||{},Z=!0)}async function xe(){await Y.set(L.USER_CACHE,T)}async function G(e){await ke();const t={},n=[];for(const r of e)T[r]?t[r]=T[r]:n.push(r);for(const r of n){const s=await ye(r);T[r]=s.displayName,t[r]=s.displayName}return n.length>0&&await xe(),t}const O={slack_default:{name:"Slack Default",enabled:!0,category:"slack",frontmatter:{title:"{{channel}}",source:"{{source_category}}",source_url:"{{source_url}}",workspace:"{{workspace}}",channel:"{{channel}}",channel_type:"{{channel_type}}",captured:'{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',date_range:"{{date_range}}",message_count:"{{message_count}}",tags:["slack"]}},slack_detailed:{name:"Slack Detailed",enabled:!1,category:"slack",frontmatter:{title:"{{channel}}",source:"{{source_category}}",source_url:"{{source_url}}",workspace:"{{workspace}}",channel:"{{channel}}",channel_type:"{{channel_type}}",topic:"{{topic}}",purpose:"{{purpose}}",captured:'{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',date_range:"{{date_range}}",message_count:"{{message_count}}",export_scope:"{{export_scope}}",tags:["slack","{{workspace|lowercase|slug}}"]}},web_default:{name:"Web Clip Default",enabled:!0,category:"web",frontmatter:{title:"{{title}}",source:"{{source_category}}",source_url:"{{source_url}}",author:"{{author}}",published:'{{published|date:"YYYY-MM-DD"}}',captured:'{{captured|date:"YYYY-MM-DDTHH:mm:ssZ"}}',tags:["web-clip"]}}};new Set(Object.keys(O));let Q;function ve(e){Q=e}function Se(e){if(!e)return structuredClone(O);const t={...e};for(const[n,r]of Object.entries(O))n in t||(t[n]=structuredClone(r));return t}function $e(e,t){for(const n of Object.values(e))if(n.category===t&&n.enabled)return n;return null}async function Te(){const e=await Q.get(L.TEMPLATES);return Se(e??null)}async function Ce(e){const t=await Te();return $e(t,e)}class Me{async getToken(){const t=window.boot_data,n=t==null?void 0:t.api_token;return typeof n=="string"&&n.startsWith("xoxc-")?n:void 0}async getCookie(){return"__AUTO__"}async clearToken(){}}class Ee{post(t,n,r){return new Promise((s,a)=>{const{Cookie:o,...f}=n;GM_xmlhttpRequest({method:"POST",url:t,headers:f,data:r,onload:l=>s({ok:l.status>=200&&l.status<300,status:l.status,json:()=>Promise.resolve(JSON.parse(l.responseText))}),onerror:l=>a(new Error(`Network error: ${l.error}`))})})}}class De{async get(t){return GM_getValue(t,void 0)}async set(t,n){GM_setValue(t,n)}async remove(t){GM_deleteValue(t)}}function Ae(e,t){return e.elements.map(n=>Le(n,t)).join(`

`)}function Le(e,t){switch(e.type){case"rich_text_section":return q(e,t);case"rich_text_list":return Ie(e,t);case"rich_text_preformatted":return Ue(e,t);case"rich_text_quote":return Ye(e,t);default:return""}}function q(e,t){return e.elements.map(n=>F(n,t)).join("")}function Ie(e,t){const n="  ".repeat(e.indent||0);return e.elements.map((r,s)=>{const a=q(r,t),o=e.style==="ordered"?`${s+1}.`:"-";return`${n}${o} ${a}`}).join(`
`)}function Ue(e,t){return"```\n"+e.elements.map(r=>F(r,t)).join("")+"\n```"}function Ye(e,t){return e.elements.map(r=>F(r,t)).join("").split(`
`).map(r=>`> ${r}`).join(`
`)}function F(e,t){switch(e.type){case"text":return J(e.text,e.style);case"link":{const n=e.text?`[${e.text}](${e.url})`:`<${e.url}>`;return e.style?J(n,e.style):n}case"emoji":return`:${e.name}:`;case"user":return`@${t.resolveUser(e.user_id)}`;case"channel":return`#${t.resolveChannel(e.channel_id)}`;case"usergroup":return"@group";case"broadcast":return`@${e.range}`;default:return""}}function J(e,t){if(!t)return e;if(t.code)return`\`${e}\``;let n=e;return t.bold&&t.italic?n=`***${n}***`:t.bold?n=`**${n}**`:t.italic&&(n=`*${n}*`),t.strike&&(n=`~~${n}~~`),n}function V(e,t){let n=e;return n=n.replace(/<@(U[A-Z0-9]+)>/g,(r,s)=>`@${t.resolveUser(s)}`),n=n.replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g,(r,s,a)=>`#${a}`),n=n.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g,"[$2]($1)"),n=n.replace(/<(https?:\/\/[^>]+)>/g,"<$1>"),n=n.replace(new RegExp("(?<![`\\\\])\\*([^*\\n]+)\\*(?!`)","g"),"**$1**"),n=n.replace(new RegExp("(?<![`\\\\])_([^_\\n]+)_(?!`)","g"),"*$1*"),n=n.replace(new RegExp("(?<![`\\\\])~([^~\\n]+)~(?!`)","g"),"~~$1~~"),n}function K(e){const t=parseFloat(e)*1e3,n=new Date(t),r=n.toISOString().split("T")[0],s=n.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0});return{date:r,time:s}}function Oe(e,t){return`**${e}** — ${t}`}const X=80;function Fe(e,t,n,r){const s=r.length>X?r.slice(0,X)+"…":r;return`> **Thread** (${e} ${e===1?"reply":"replies"} to ${t} — ${n}: “${s}”):`}function Pe(e){return e.length?`> ${e.map(n=>`:${n.name}: ${n.count}`).join(" · ")}`:""}function Re(e){const t=e.permalink||e.url_private;return t?`📎 [${e.name}](${t})`:`📎 ${e.name} (no public URL)`}function ze(e){return`*${e}*`}function je(e,t){const n=new Date().toISOString().split("T")[0];return[`# #${e}`,"",`Exported from Slack · ${n} · Messages: ${t}`,"","---"].join(`
`)}const Ne=new Set(["channel_join","channel_leave","channel_topic","channel_purpose","channel_name","channel_archive"]);function He(e,t){var f,l,g;const n=c=>t.userMap[c]||c,s={resolveUser:n,resolveChannel:c=>{var m;return((m=t.channelMap)==null?void 0:m[c])||c}},a=[];let o="";t.skipDocumentHeader||a.push(je(t.channelName,e.length));for(const c of e){const{date:m,time:y}=K(c.ts);if(m!==o&&(o=m,a.push(`## ${m}`)),c.subtype&&Ne.has(c.subtype)){const u=V(c.text,s);a.push(ze(u));continue}const d=c.user?n(c.user):c.username||"Unknown";if(a.push(Oe(d,y)),a.push(P(c,s)),t.includeReactions&&((f=c.reactions)!=null&&f.length)&&a.push(Pe(c.reactions)),t.includeFiles&&((l=c.files)!=null&&l.length))for(const u of c.files)a.push(Re(u));if(t.includeThreadReplies&&c.thread_ts===c.ts&&c.reply_count&&c.reply_count>0){const u=(g=t.threadReplies)==null?void 0:g[c.ts];if(u&&u.length>1){const _=P(c,s),p=u.length-1,h=[];h.push(Fe(p,d,y,_));for(const b of u.slice(1)){const{time:w}=K(b.ts),C=b.user?n(b.user):b.username||"Unknown";h.push(">"),h.push(`> **${C}** — ${w}`);const M=P(b,s);for(const E of M.split(`
`))h.push(`> ${E}`)}a.push(h.join(`
`))}}}return a.join(`

`)}function P(e,t){var r;const n=(r=e.blocks)==null?void 0:r.find(s=>s.type==="rich_text");return n?Ae(n,t):V(e.text,t)}const Be=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],We=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function Ze(e,t){const n=e.getFullYear(),r=e.getMonth(),s=e.getDate(),a=e.getHours(),o=e.getMinutes(),f=e.getSeconds(),l=e.getTimezoneOffset(),g=l<=0?"+":"-",c=String(Math.floor(Math.abs(l)/60)).padStart(2,"0"),m=String(Math.abs(l)%60).padStart(2,"0"),y=`${g}${c}:${m}`;let d=t;return d=d.replace(/YYYY/g,String(n)),d=d.replace(/MMM/g,We[r]),d=d.replace(/MM/g,String(r+1).padStart(2,"0")),d=d.replace(/DD/g,String(s).padStart(2,"0")),d=d.replace(/HH/g,String(a).padStart(2,"0")),d=d.replace(/mm/g,String(o).padStart(2,"0")),d=d.replace(/ss/g,String(f).padStart(2,"0")),d=d.replace(/ddd/g,Be[e.getDay()]),d=d.replace(/Z/g,y),d}function Ge(e){const t=Qe(e.trim()),n=t[0].trim(),r=[];for(let s=1;s<t.length;s++){const a=t[s].trim();if(!a)continue;const o=qe(a);if(o===-1)r.push({name:a});else{const f=a.slice(0,o).trim();let l=a.slice(o+1).trim();(l.startsWith('"')&&l.endsWith('"')||l.startsWith("'")&&l.endsWith("'"))&&(l=l.slice(1,-1)),r.push({name:f,arg:l})}}return{variable:n,filters:r}}function Qe(e){const t=[];let n="",r=null;for(const s of e)r?(n+=s,s===r&&(r=null)):s==='"'||s==="'"?(n+=s,r=s):s==="|"?(t.push(n),n=""):n+=s;return t.push(n),t}function qe(e){let t=null;for(let n=0;n<e.length;n++){const r=e[n];if(t)r===t&&(t=null);else if(r==='"'||r==="'")t=r;else if(r===":")return n}return-1}function Je(e){if(e instanceof Date)return e;if(typeof e=="string"){const t=new Date(e);if(!isNaN(t.getTime()))return t}if(typeof e=="number"){const t=new Date(e);if(!isNaN(t.getTime()))return t}return null}function Ve(e,t){switch(t.name){case"date":{const n=Je(e);return n?Ze(n,t.arg??"YYYY-MM-DD"):e}case"lowercase":return String(e??"").toLowerCase();case"uppercase":return String(e??"").toUpperCase();case"default":return e==null||e===""?t.arg??"":e;case"join":{if(Array.isArray(e)){const n=t.arg??", ";return e.join(n)}return e}case"slug":return String(e??"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");case"trim":return String(e??"").trim();case"truncate":{const n=String(e??""),r=parseInt(t.arg??"100",10);return n.length<=r?n:n.slice(0,r)+"…"}default:return e}}function ee(e,t){const n=/^\{\{(.+?)\}\}$/.exec(e);return n?te(n[1],t):e.replace(/\{\{(.+?)\}\}/g,(r,s)=>{const a=te(s,t);return a==null?"":String(a)})}function te(e,t){const n=Ge(e);let r=t[n.variable];for(const s of n.filters)r=Ve(r,s);return r}function Ke(e,t){const n={};for(const[r,s]of Object.entries(e))if(typeof s=="string"){const a=ee(s,t);if(a==null||a==="")continue;n[r]=a}else if(Array.isArray(s)){const a=s.map(o=>typeof o=="string"?ee(o,t):o).filter(o=>o!=null&&o!=="");a.length>0&&(n[r]=a)}else s!=null&&(n[r]=s);return n}function ne(e){return e.is_im?"slack-dm":e.is_mpim?"slack-group-dm":e.is_group&&!e.is_mpim||e.is_private?"slack-private-channel":"slack-channel"}function re(e){return e.is_im?"dm":e.is_mpim?"group_dm":e.is_group&&!e.is_mpim||e.is_private?"private_channel":"public_channel"}function se(e,t){return`https://${e}.slack.com/archives/${t}`}function ae(e){if(e.length===0)return"";const t=parseFloat(e[0].ts)*1e3,n=parseFloat(e[e.length-1].ts)*1e3,r=new Date(t).toISOString().split("T")[0],s=new Date(n).toISOString().split("T")[0];return r===s?r:`${r} to ${s}`}function oe(e){if(e==null)return"";if(typeof e=="number"||typeof e=="boolean")return String(e);const t=String(e);return t===""?'""':/[:#\[\]{}&*!|>'"%@`,?]/.test(t)||/^\s|\s$/.test(t)||/^(true|false|null|yes|no|on|off)$/i.test(t)||/^-?\d/.test(t)?`"${t.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`:t}function ce(e){const t=["---"];for(const[n,r]of Object.entries(e))if(!(r==null||r===""))if(Array.isArray(r)){if(r.length===0)continue;t.push(`${n}:`);for(const s of r)t.push(`  - ${oe(s)}`)}else t.push(`${n}: ${oe(r)}`);return t.push("---"),t.join(`
`)}function Xe(e){return e.mode==="last_n"?`last_${e.count}`:e.mode==="date_range"?"date_range":"all"}function et(e){return{channel:e.channel.name,channel_id:e.channel.id,channel_type:re(e.channel),topic:e.channel.topic??"",purpose:e.channel.purpose??"",workspace:e.workspaceName,workspace_domain:e.workspaceDomain,source_category:ne(e.channel),source_url:se(e.workspaceDomain,e.channel.id),captured:new Date,date_range:ae(e.messages),message_count:e.messageCount,export_scope:Xe(e.scope)}}function tt(e,t){const n=et(t),r=Ke(e.frontmatter,n);return ce(r)}function ie(e){const t=ne(e.channel),n=re(e.channel),r=se(e.workspaceDomain,e.channel.id),s=ae(e.messages),a=new Date().toISOString(),o={title:`#${e.channel.name}`,source:t,source_url:r,workspace:e.workspaceName,channel:e.channel.name,channel_type:n,captured:a,date_range:s,message_count:e.messageCount,tags:["slack"]};return ce(o)}async function nt(e){var g,c,m,y,d;const t={};e.scope.mode==="last_n"?t.limit=e.scope.count:e.scope.mode==="date_range"&&(t.oldest=String(e.scope.oldest),t.latest=String(e.scope.latest)),(g=e.onProgress)==null||g.call(e,{current:0,phase:"fetching"});const n=await ge(e.channelId,{...t,onPage:u=>{var _;return(_=e.onProgress)==null?void 0:_.call(e,{current:u,phase:"fetching"})}});(c=e.onProgress)==null||c.call(e,{current:0,phase:"resolving_users"});const r=rt(n),s=await G(Array.from(r)),a=await W(e.channelId);let o;if(e.includeThreads){o={};const u=n.filter(p=>p.thread_ts===p.ts&&p.reply_count&&p.reply_count>0);(m=e.onProgress)==null||m.call(e,{current:0,total:u.length,phase:"fetching_threads"});for(let p=0;p<u.length;p++){const h=u[p],b=await _e(e.channelId,h.ts);o[h.ts]=b;for(const w of b)w.user&&r.add(w.user);(y=e.onProgress)==null||y.call(e,{current:p+1,total:u.length,phase:"fetching_threads"}),p<u.length-1&&await new Promise(w=>setTimeout(w,I))}const _=await G(Array.from(r));Object.assign(s,_)}(d=e.onProgress)==null||d.call(e,{current:0,phase:"converting"});const f=He(n,{channelName:a.name,userMap:s,includeReactions:e.includeReactions,includeFiles:e.includeFiles,includeThreadReplies:e.includeThreads,threadReplies:o,skipDocumentHeader:e.includeFrontmatter});let l=f;if(e.includeFrontmatter){let u={name:"",domain:""};try{u=await be()}catch{}const _={channel:a,workspaceName:u.name,workspaceDomain:u.domain,messages:n,messageCount:n.length,scope:e.scope};let p;try{const h=await Ce("slack");h?p=tt(h,_):p=ie(_)}catch{p=ie(_)}l=p+`

`+f}return{markdown:l,messageCount:n.length}}function rt(e){const t=new Set;for(const n of e)if(n.user&&t.add(n.user),n.blocks){for(const r of n.blocks)if(r.type==="rich_text"){for(const s of r.elements)if("elements"in s)for(const a of s.elements)a.type==="user"&&t.add(a.user_id)}}return t}const st=`
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #e1e1e1;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .hidden { display: none !important; }

  .s2md-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #4a6cf7;
    color: #fff;
    border: none;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.15s, background 0.15s;
  }
  .s2md-toggle:hover { background: #3a5ce7; transform: scale(1.1); }

  .s2md-panel {
    position: fixed;
    bottom: 70px;
    right: 20px;
    width: 340px;
    background: #1a1a2e;
    border: 1px solid #333355;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 99998;
    overflow: hidden;
  }

  .s2md-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #22223a;
    border-bottom: 1px solid #333355;
  }
  .s2md-header h2 { font-size: 14px; font-weight: 600; color: #fff; }
  .s2md-close {
    background: none; border: none; color: #8888aa; cursor: pointer;
    font-size: 18px; line-height: 1;
  }
  .s2md-close:hover { color: #fff; }

  .s2md-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }

  .s2md-status { color: #a0a0b8; padding: 4px 0; font-size: 12px; }

  .s2md-field { display: flex; flex-direction: column; gap: 4px; }
  .s2md-label { font-size: 11px; color: #8888aa; text-transform: uppercase; letter-spacing: 0.5px; }
  .s2md-channel { font-family: 'SF Mono','Menlo','Monaco',monospace; font-size: 14px; color: #7eb8ff; }

  select, input[type="date"] {
    background: #2a2a42; color: #e1e1e1; border: 1px solid #444466;
    border-radius: 4px; padding: 6px 8px; font-size: 13px;
  }
  input[type="date"] { padding: 4px 8px; font-size: 12px; color-scheme: dark; }

  .s2md-date-row { flex-direction: row; gap: 8px; }
  .s2md-date-row label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #8888aa; }

  .s2md-options { gap: 2px; }
  .s2md-options label {
    display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0;
  }

  .s2md-progress { display: flex; flex-direction: column; gap: 4px; }
  .s2md-progress-bar { width: 100%; height: 4px; background: #2a2a42; border-radius: 2px; overflow: hidden; }
  .s2md-progress-fill { height: 100%; background: #7eb8ff; border-radius: 2px; transition: width 0.3s ease; width: 0%; }
  .s2md-progress-text { font-size: 11px; color: #8888aa; }

  .s2md-actions { display: flex; gap: 8px; }
  .s2md-btn {
    flex: 1; padding: 8px 12px; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s;
  }
  .s2md-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .s2md-btn-primary { background: #4a6cf7; color: #fff; }
  .s2md-btn-primary:hover:not(:disabled) { background: #3a5ce7; }
  .s2md-btn-secondary { background: #2a2a42; color: #e1e1e1; border: 1px solid #444466; }
  .s2md-btn-secondary:hover:not(:disabled) { background: #3a3a52; }

  .s2md-result {
    background: #1a3a1a; border: 1px solid #44cc44; color: #88ff88;
    padding: 8px 10px; border-radius: 6px; font-size: 12px;
  }
  .s2md-error {
    background: #3a1a1a; border: 1px solid #cc4444; color: #ff8888;
    padding: 8px 10px; border-radius: 6px; font-size: 12px;
  }

  .s2md-version { text-align: right; font-size: 10px; color: #555577; margin-top: 4px; }
`,at=`
  <div class="s2md-header">
    <h2>s2md</h2>
    <button class="s2md-close" title="Close">&times;</button>
  </div>
  <div class="s2md-body">
    <div class="s2md-status" id="s2md-status">Detecting channel...</div>

    <div id="s2md-controls" class="hidden">
      <div class="s2md-field">
        <span class="s2md-label">Channel</span>
        <span class="s2md-channel" id="s2md-channel">--</span>
      </div>

      <div class="s2md-field">
        <label class="s2md-label">Export scope</label>
        <select id="s2md-scope">
          <option value="last_50">Last 50</option>
          <option value="last_100" selected>Last 100</option>
          <option value="last_200">Last 200</option>
          <option value="last_500">Last 500</option>
          <option value="date_range">Date range</option>
          <option value="all">All messages</option>
        </select>
      </div>

      <div id="s2md-date-opts" class="s2md-field s2md-date-row hidden">
        <label>From <input type="date" id="s2md-date-from"></label>
        <label>To <input type="date" id="s2md-date-to"></label>
      </div>

      <div class="s2md-field s2md-options">
        <label><input type="checkbox" id="s2md-threads"> Thread replies</label>
        <label><input type="checkbox" id="s2md-reactions" checked> Reactions</label>
        <label><input type="checkbox" id="s2md-files" checked> File references</label>
        <label><input type="checkbox" id="s2md-frontmatter"> YAML frontmatter</label>
      </div>

      <div id="s2md-progress" class="s2md-progress hidden">
        <div class="s2md-progress-bar"><div class="s2md-progress-fill" id="s2md-progress-fill"></div></div>
        <span class="s2md-progress-text" id="s2md-progress-text">Starting...</span>
      </div>

      <div class="s2md-actions">
        <button class="s2md-btn s2md-btn-primary" id="s2md-copy">Copy Markdown</button>
        <button class="s2md-btn s2md-btn-secondary" id="s2md-download">Download .md</button>
      </div>

      <div id="s2md-result" class="s2md-result hidden"></div>
      <div id="s2md-error" class="s2md-error hidden"></div>
    </div>

    <div class="s2md-version" id="s2md-version"></div>
  </div>
`;function ot(e){const t=document.createElement("div");t.id="s2md-host",document.body.appendChild(t);const n=t.attachShadow({mode:"open"}),r=document.createElement("style");r.textContent=st,n.appendChild(r);const s=document.createElement("button");s.className="s2md-toggle",s.textContent="md",s.title="scrape-to-markdown",n.appendChild(s);const a=document.createElement("div");a.className="s2md-panel hidden",a.innerHTML=at,n.appendChild(a);const o=i=>n.querySelector(i),f=o("#s2md-status"),l=o("#s2md-controls"),g=o("#s2md-channel"),c=o("#s2md-scope"),m=o("#s2md-date-opts"),y=o("#s2md-date-from"),d=o("#s2md-date-to"),u=o("#s2md-threads"),_=o("#s2md-reactions"),p=o("#s2md-files"),h=o("#s2md-frontmatter"),b=o("#s2md-progress"),w=o("#s2md-progress-fill"),C=o("#s2md-progress-text"),M=o("#s2md-copy"),E=o("#s2md-download"),D=o("#s2md-result"),R=o("#s2md-error"),it=o("#s2md-version"),lt=n.querySelector(".s2md-close");try{it.textContent="v0.1.0"}catch{}let z=null,j=null,x=!1;s.addEventListener("click",()=>{x=!x,a.classList.toggle("hidden",!x),x&&pe()}),lt.addEventListener("click",()=>{x=!1,a.classList.add("hidden")}),c.addEventListener("change",()=>{m.classList.toggle("hidden",c.value!=="date_range")});const de=new Date,dt=new Date(de.getTime()-7*24*60*60*1e3);d.value=de.toISOString().split("T")[0],y.value=dt.toISOString().split("T")[0];function ut(){const i=c.value;if(i==="date_range"){const k=y.value?new Date(y.value).getTime()/1e3:0,S=d.value?new Date(d.value+"T23:59:59").getTime()/1e3:Date.now()/1e3;return{mode:"date_range",oldest:k,latest:S}}return i==="all"?{mode:"all"}:{mode:"last_n",count:parseInt(i.replace("last_",""),10)}}function pt(i){b.classList.remove("hidden");const k={fetching:"Fetching messages",resolving_users:"Resolving users",fetching_threads:"Fetching threads",converting:"Converting"}[i.phase]||i.phase;if(i.total){const S=Math.round(i.current/i.total*100);w.style.width=`${S}%`,C.textContent=`${k}: ${i.current}/${i.total}`}else w.style.width="",C.textContent=i.current>0?`${k} (page ${i.current})...`:`${k}...`}async function ue(){if(!z)return null;D.classList.add("hidden"),R.classList.add("hidden"),b.classList.remove("hidden"),w.style.width="0%",C.textContent="Starting...",M.disabled=!0,E.disabled=!0;try{const i=await e.exportSlackChannel({channelId:z,scope:ut(),includeThreads:u.checked,includeReactions:_.checked,includeFiles:p.checked,includeFrontmatter:h.checked,onProgress:pt});return D.textContent=`Exported ${i.messageCount} messages`,D.classList.remove("hidden"),i.markdown}catch(i){return R.textContent=i instanceof Error?i.message:String(i),R.classList.remove("hidden"),null}finally{b.classList.add("hidden"),M.disabled=!1,E.disabled=!1}}M.addEventListener("click",async()=>{const i=await ue();i&&(await navigator.clipboard.writeText(i),D.textContent+=" — copied!")}),E.addEventListener("click",async()=>{const i=await ue();if(!i)return;const v=j?`${j}-${new Date().toISOString().split("T")[0]}.md`:`slack-export-${new Date().toISOString().split("T")[0]}.md`,k=new Blob([i],{type:"text/markdown"}),S=URL.createObjectURL(k),N=document.createElement("a");N.href=S,N.download=v,N.click(),URL.revokeObjectURL(S),D.textContent+=" — downloaded!"});async function pe(){const i=e.detectChannel();if(!i){f.textContent="Navigate to a Slack channel to begin.",l.classList.add("hidden"),f.classList.remove("hidden");return}z=i.channelId;try{const v=await W(i.channelId);j=v.name,g.textContent=`#${v.name}`}catch{g.textContent=i.channelId}f.classList.add("hidden"),l.classList.remove("hidden")}let fe=location.pathname;setInterval(()=>{location.pathname!==fe&&(fe=location.pathname,x&&pe())},2e3)}const le=new De;he(new Me,new Ee),we(le),ve(le);function ct(){const e=location.pathname.match(/^\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i);return e?{workspaceId:e[1],channelId:e[2]}:null}ot({detectChannel:ct,exportSlackChannel:nt})})();
