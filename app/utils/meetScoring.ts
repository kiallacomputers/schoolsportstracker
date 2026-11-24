export function parseMeetPoints(text:string){
 const parts=text.split(',').map(v=>v.trim())
 if(!parts.length||parts.length>30||parts.some(v=>v===''||!/^(?:\d+)(?:\.\d{1,2})?$/.test(v)))throw new Error('Enter 1 to 30 non-negative point values separated by commas (up to 2 decimals)')
 const values=parts.map(Number)
 if(values.some(v=>!Number.isFinite(v)||v>10000))throw new Error('Each placing must be between 0 and 10000 points')
 return values
}
