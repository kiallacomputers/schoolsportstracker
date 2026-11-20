export type Student={id:string;student_number:string;given_name:string;family_name:string;email:string|null;date_of_birth:string|null;is_active:boolean;gender:string|null;sporting_division:string|null}
export type Enrolment={id:string;student_id:string;school_year:number;year_level:string;house_id:string|null}
export type House={id:string;name:string;colour:string}
export function useStudents(){
 const db=useSupabaseClient();const {schoolId}=useSchool()
 const students=ref<Student[]>([]),enrolments=ref<Enrolment[]>([]),houses=ref<House[]>([])
 const year=ref(new Date().getFullYear()),loading=ref(false),saving=ref(false),error=ref('')
 const enrolmentMap=computed(()=>new Map(enrolments.value.map(e=>[e.student_id,e])))
 const houseMap=computed(()=>new Map(houses.value.map(h=>[h.id,h])))
 async function load(){if(!schoolId.value){students.value=[];enrolments.value=[];houses.value=[];return}
 loading.value=true;error.value=''
 try{const id=schoolId.value;const [s,e,h]=await Promise.all([
 db.from('students').select('id,student_number,given_name,family_name,email,date_of_birth,is_active,gender,sporting_division').eq('school_id',id).order('family_name'),
 db.from('student_enrolments').select('id,student_id,school_year,year_level,house_id').eq('school_id',id).eq('school_year',year.value),
 db.from('school_houses').select('id,name,colour').eq('school_id',id).order('name')])
 if(s.error||e.error||h.error)throw s.error||e.error||h.error
 students.value=(s.data||[]) as Student[];enrolments.value=(e.data||[]) as Enrolment[];houses.value=(h.data||[]) as House[]
 }catch(e:any){error.value=e.message||'Unable to load students'}finally{loading.value=false}}
 async function save(form:Partial<Student>&{student_number:string;given_name:string;family_name:string},yearLevel:string,houseId:string){
 if(!schoolId.value)throw new Error('Select a school');saving.value=true
 try{const payload={school_id:schoolId.value,student_number:form.student_number.trim(),given_name:form.given_name.trim(),family_name:form.family_name.trim(),email:form.email?.trim()||null,date_of_birth:form.date_of_birth||null,gender:form.gender||null,sporting_division:form.sporting_division||null,is_active:form.is_active!==false}
 if(!payload.student_number||!payload.given_name||!payload.family_name)throw new Error('Student number and names are required')
 const result=form.id?await db.from('students').update(payload).eq('id',form.id).eq('school_id',schoolId.value).select('id').single():await db.from('students').insert(payload).select('id').single()
 if(result.error)throw result.error
 const studentId=result.data.id;const existing=enrolmentMap.value.get(studentId)
 const enrolmentResult=existing?await db.from('student_enrolments').update({year_level:yearLevel,house_id:houseId||null}).eq('id',existing.id).eq('school_id',schoolId.value):await db.from('student_enrolments').insert({school_id:schoolId.value,student_id:studentId,school_year:year.value,year_level:yearLevel,house_id:houseId||null})
 if(enrolmentResult.error)throw enrolmentResult.error
 await load()
 }finally{saving.value=false}}
 return {students,enrolments,houses,year,loading,saving,error,enrolmentMap,houseMap,load,save}
}
