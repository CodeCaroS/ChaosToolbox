export { useAppShell } from "./useAppShellRuntime";

/*
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import MarkdownEditor from "markdown-text-editor";

label:"Links"
label:"RSS Feed"
label:"OPML Import"
label:"E-Mail Import"
label:"TikTok Note"
label:"Second Brain Git"
sourceTools=[Links,RSS Feed,OPML Import,E-Mail Import,TikTok Note]
navItems=[Second Brain Git]
return{sourceTools,navItems,noteStatuses,currentView}
selectedSourceLinkId
selectedSourceLink
editingSourceLinkId
sourceEditForm
suggestSourceTags
/api/links/preview
Created ${payload?.path}
noteMetadata(note).status==="inbox"
visibleInboxItems
kind:"note"
jobs=ref([])
const inboxNotes=computed
sourcePath?.split
const reviewQueue=ref([])
const noteForm=reactive({title:"",body:"",kind:"knowledge",status:"draft",topic:"",tags:"",summary:"",extraYaml:""})
const noteEditForm=reactive({title:"",body:"",kind:"knowledge",status:"draft",topic:"",tags:"",summary:"",extraYaml:""})
function startEditNote(note){destroyNoteMarkdownEditor();nextTick(initNoteMarkdownEditor)}
function cancelEditNote(){destroyNoteMarkdownEditor()}
function openNewNoteForm(){nextTick(initNoteMarkdownEditor)}
function suggestNoteMetadata(target){applySuggestedNoteMetadata(target,result)}
async function normalizeNoteHeaders(target){fetch("/api/notes/markdown/normalize-headers",{method:"POST"})}
async function noteSource(link){await enqueueJob(`/api/links/${link.id}/note`,{})}
function noteFormMeta(form){return{title:form.title.trim(),kind:form.kind,status:form.status,topic:form.topic,tags:normalizeTags(form.tags),summary:form.summary.trim(),extraYaml:form.extraYaml.trim()}}
function applyNoteMetadata(form,meta){form.kind=meta.kind||"knowledge";form.status=meta.status||"draft";form.topic=meta.topic||"";form.tags=(meta.tags??[]).join(", ");form.summary=meta.summary||"";form.extraYaml=meta.extraYaml||""}
function resetNoteMetadata(form){form.kind="knowledge";form.status="draft";form.topic="";form.tags="";form.summary="";form.extraYaml=""}
function initNoteMarkdownEditor(){if(!noteBodyTextarea.value||noteMarkdownEditor)return;noteMarkdownEditor=new MarkdownEditor(noteBodyTextarea.value)}
function destroyNoteMarkdownEditor(){noteMarkdownEditor?.destroy();noteMarkdownEditor=null}
async function enqueueJob(url,body,onDone,method="POST"){response.json().catch(()=>null);gitResult.value=`Queued: ${payload.job?.title??"job"}`;// queue
}
async function loadJobs(){try{jobs.value=await getJson("/api/jobs");await handleCompletedJobs()}catch(_error){jobs.value=[]}setInterval(loadJobs,1500)}
async function loadReviewQueue(){}
async function setReviewStatus(item,status){}
async function deleteNote(note){await enqueueJob(`/api/notes/${note.id}`,{},()=>{},"DELETE")}
async function createTikTokNote(){await enqueueJob("/api/second-brain/tiktok-note",{url:tiktokNoteForm.url},()=>{})}
*/
