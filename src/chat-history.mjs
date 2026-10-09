/** Keep a bounded, recent conversation without ever sending UI metadata. */
export function recentChat(messages) {
 let length=0;const result=[];
 for(const message of messages.slice(-12).reverse()){
  if(length+message.content.length>20000)break;
  length+=message.content.length;result.unshift({role:message.role,content:message.content});
 }
 return result;
}
