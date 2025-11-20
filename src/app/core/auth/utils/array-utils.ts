export class ArrayUtils{
    static removeElementFromArray(array: any[], element:any,copy:boolean){
    let index = array.indexOf(element);
    if(copy){
      let copyArr: any[] = new Array(...array);
      copyArr.splice(index,1);
      return copyArr;
    }
    return array.splice(index,1); 
  }

}