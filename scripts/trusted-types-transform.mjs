function fail(message){throw new Error(message);}
function skipQuoted(source,index,quote){let i=index+1;while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i]===quote)return i+1;if(source[i]==='\n')fail(`Unterminated ${quote} string while rewriting innerHTML`);i+=1;}fail(`Unterminated ${quote} string while rewriting innerHTML`);}
function skipLineComment(source,index){const end=source.indexOf('\n',index+2);return end===-1?source.length:end+1;}
function skipBlockComment(source,index){const end=source.indexOf('*/',index+2);if(end===-1)fail('Unterminated block comment while rewriting innerHTML');return end+2;}
function skipRegex(source,index){let i=index+1,inClass=false;while(i<source.length){const ch=source[i];if(ch==='\\'){i+=2;continue;}if(ch==='[')inClass=true;else if(ch===']')inClass=false;else if(ch==='/'&&!inClass){i+=1;while(/[a-z]/i.test(source[i]||''))i+=1;return i;}if(ch==='\n')fail('Unterminated regular expression while rewriting innerHTML');i+=1;}fail('Unterminated regular expression while rewriting innerHTML');}
function regexCanStart(previous){return !previous||/[({[=,:;!?&|+\-*%^~<>]/.test(previous);}
function skipTemplateExpression(source,index){let depth=1,i=index,previous='';while(i<source.length){const ch=source[i],next=source[i+1];if(ch==="'"||ch==='"'){i=skipQuoted(source,i,ch);previous='v';continue;}if(ch==='`'){i=skipTemplate(source,i);previous='v';continue;}if(ch==='/'&&next==='/'){i=skipLineComment(source,i);continue;}if(ch==='/'&&next==='*'){i=skipBlockComment(source,i);continue;}if(ch==='/'&&regexCanStart(previous)){i=skipRegex(source,i);previous='v';continue;}if(ch==='{')depth+=1;else if(ch==='}'){depth-=1;if(depth===0)return i+1;}previous=/\s/.test(ch)?previous:ch;i+=1;}fail('Unterminated template expression while rewriting innerHTML');}
function skipTemplate(source,index){let i=index+1;while(i<source.length){const ch=source[i];if(ch==='\\'){i+=2;continue;}if(ch==='`')return i+1;if(ch==='$'&&source[i+1]==='{'){i=skipTemplateExpression(source,i+2);continue;}i+=1;}fail('Unterminated template literal while rewriting innerHTML');}
function findExpressionEnd(source,start){const stack=[];let i=start,previous='';while(i<source.length){const ch=source[i],next=source[i+1];if(ch==="'"||ch==='"'){i=skipQuoted(source,i,ch);previous='v';continue;}if(ch==='`'){i=skipTemplate(source,i);previous='v';continue;}if(ch==='/'&&next==='/'){i=skipLineComment(source,i);continue;}if(ch==='/'&&next==='*'){i=skipBlockComment(source,i);continue;}if(ch==='/'&&regexCanStart(previous)){i=skipRegex(source,i);previous='v';continue;}if(ch==='('||ch==='['||ch==='{')stack.push(ch==='('?')':ch==='['?']':'}');else if(ch===')'||ch===']'||ch==='}'){const close=stack.pop();if(close!==ch)fail(`Unbalanced ${ch} while rewriting innerHTML`);}else if(ch===';'&&stack.length===0)return i;previous=/\s/.test(ch)?previous:ch;i+=1;}fail('Could not find the end of an innerHTML assignment');}
function findLhsStart(source,dotIndex){let paren=0,bracket=0;for(let i=dotIndex-1;i>=0;i-=1){const ch=source[i];if(ch===')')paren+=1;else if(ch==='(')paren-=1;else if(ch===']')bracket+=1;else if(ch==='[')bracket-=1;if(paren<0||bracket<0)fail('Unbalanced left-hand expression while rewriting innerHTML');if(paren===0&&bracket===0&&(ch===';'||ch==='\n'||ch==='{'||ch==='}'))return i+1;}return 0;}
export function rewriteInnerHTMLAssignments(input,setter='window.__PACEFOLD_SET_HTML__'){
  let source=String(input),cursor=0,count=0;
  while(true){
    const match=/\.innerHTML\s*=\s*/g;match.lastIndex=cursor;const found=match.exec(source);if(!found)break;
    const dot=found.index,lhsStart=findLhsStart(source,dot),lhs=source.slice(lhsStart,dot).trim();
    if(!lhs||/\b(?:if|for|while|return)\b/.test(lhs))fail(`Unsafe innerHTML left-hand expression: ${lhs}`);
    const rhsStart=match.lastIndex,end=findExpressionEnd(source,rhsStart),rhs=source.slice(rhsStart,end).trim(),leading=source.slice(lhsStart,dot).match(/^\s*/)?.[0]||'',replacement=`${leading}${setter}(${lhs},${rhs})`;
    source=source.slice(0,lhsStart)+replacement+source.slice(end);cursor=lhsStart+replacement.length+1;count+=1;
  }
  if(/\.innerHTML\s*=/.test(source))fail('An innerHTML assignment survived rewriting');
  return{source,count};
}
