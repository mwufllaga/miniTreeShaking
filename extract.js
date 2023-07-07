const path = require('path');
const fs  = require('fs')
const { parse } = require('@babel/parser');
const { default: traverse } = require('@babel/traverse');
let tree = {
    entryName:'root',
    children:[]
}
const rootDir = 'miravia-logistics-op-brain-f'
const treeShakingRoot = './src/pages/search_tool/index'
const srcPath = './src'
function addToExtractTree(filepath,srcPath){
   const absolutePath =  path.resolve(filepath)
   const absoluteSrcPath = path.resolve(srcPath)
   const pathArr = absolutePath.split(path.sep)
   let parent = tree
   for(let i in pathArr){
     const exist = parent.children.filter((item)=>{
          return item.entryName === pathArr[i]
      })
      if(exist.length === 0){
        const tempParent = {
            entryName:pathArr[i],
            children:[]
        }
        parent.children.push(tempParent)
        parent = tempParent
      }else{
          parent = exist[0]
      }
   }
   const deps = collectDeps(filepath,absoluteSrcPath)
   deps.forEach(dep => {
    addToExtractTree(dep,srcPath);
  });
}
function collectDeps(file,srcPath){
    //是否样式文件 TODO 暂不处理
    if(isStyleFile(file))
     return []
    // 保存依赖
    const deps = [];
    // 读取js内容
    let content = tryRead(file, 'utf-8');
    // 将代码转化为AST树
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['exportDefaultFrom','typescript','jsx'],
    });
    // 遍历AST
    traverse(ast, {
      ImportDeclaration: ({ node }) => {
        // 获取import from 地址
        const { value } = node.source;
        let filepath 
        if (value.startsWith('../') || value.startsWith('./')){
            filepath = path.join(path.dirname(file),value)
        }else if(value.startsWith('@/')){
            filepath =  value.replace('@',srcPath)
        }
        if (filepath) {
          deps.push(filepath);
        }
      },
      CallExpression: ({ node }) => {
        // 函数表达式调用，require, require.async
        if (
          (isRequireFunction(node)) && node.arguments.length > 0) {
          const [{ value }] = node.arguments;
          let filepath 
          if (value.startsWith('../') || value.startsWith('./')){
              filepath = path.join(path.dirname(file),value)
          }else if(value.startsWith('@/')){
              filepath =  value.replace('@',srcPath)
          }
          
          if (filepath) {
            deps.push(filepath);
          }
        }
      }
    });
    return deps;
}

function isRequireFunction(node) {
    const fnName = node.callee.name;
    if (fnName) {
        return fnName === 'require' || fnName === 'requireAsync';
    }
    const obj = node.callee.object;
    const property  = node.callee.property;
    if (obj && property) {
        return obj.name === 'require' && property.name === 'async' || property.name === 'requireAsync'
    }
    return false;
}
function isStyleFile(file){
    if(file.indexOf('.css')!= -1 || file.indexOf('.scss')!= -1)
        return true
    if(fs.existsSync(file+'.css') || fs.existsSync(file+'.scss'))
        return true
    if(fs.existsSync(file+'/index.css') || fs.existsSync(file+'./index.scss'))
        return true
    return false
}
function tryRead(file,encode){
    console.log(file)   
    if(fs.existsSync(file+'.tsx'))
        return fs.readFileSync(file+'.tsx',encode)
    if(fs.existsSync(file+'.ts'))
        return fs.readFileSync(file+'.ts',encode)
    if(fs.existsSync(file+'.js'))
        return fs.readFileSync(file+'.js',encode)
    if(fs.existsSync(file+'/index.tsx'))
        return fs.readFileSync(file+'/index.tsx',encode)
    if(fs.existsSync(file+'/index.ts'))
        return fs.readFileSync(file+'/index.ts',encode)
    if(fs.existsSync(file+'/index.js'))
        return fs.readFileSync(file+'/index.js',encode)
    return fs.readFileSync(file,encode)
}
function tryCopy(from,to){
    console.log("copy",from,to)   
    if(fs.existsSync(from+'.tsx'))
        return fs.copyFileSync(from+'.tsx',to+'.tsx')
    if(fs.existsSync(from+'.ts'))
        return fs.copyFileSync(from+'.ts',to+'.ts')
    if(fs.existsSync(from+'.js'))
        return fs.copyFileSync(from+'.js',to+'.js')
    if(fs.existsSync(from+'/index.tsx'))
        return fs.copyFileSync(from+'/index.tsx',to+'/index.tsx')
    if(fs.existsSync(from+'/index.ts'))
        return fs.copyFileSync(from+'/index.ts',to+'/index.ts')
    if(fs.existsSync(from+'/index.js'))
        return fs.copyFileSync(from+'/index.js',to+'/index.js')
    return fs.copyFileSync(from,to)
}
function makeTreeToList(){
    const pageList = []
    let pageAdd = ''
    function traverseTreeNode(parent){
        let tempPageAddWithoutCurrentLevel = pageAdd
        pageAdd = pageAdd+ path.sep+parent.entryName
        if(parent.children.length > 0){
            for(let item of parent.children){
                traverseTreeNode(item)
            }
            pageAdd = tempPageAddWithoutCurrentLevel
        }else{
            pageList.push(pageAdd)
            pageAdd = tempPageAddWithoutCurrentLevel
        }
    }
    traverseTreeNode(tree)
    return pageList
}
function checkIfEmittedIndex(from){
    if(fs.existsSync(from+'/index.tsx') || fs.existsSync(from+'/index.ts') || fs.existsSync(from+'/index.js'))
       return  true
    return false
}
function copyExtractTree(){
    const pageList = makeTreeToList()
    function mkdirCopy(from,to) {
        const arr=to.split('/')
        let dir=arr[0];
        let loopLength = arr.length
        if(checkIfEmittedIndex(from))
            loopLength++
        for(let i=1;i<loopLength;i++){
            if(dir && !fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
            dir=dir+'/'+arr[i];
        }
        tryCopy(from,to)
    }
    
    for(let i of pageList){
        const actualPath = i.substr(6)
        mkdirCopy(actualPath, actualPath.replace(rootDir,'extract'))
    }
}
addToExtractTree(treeShakingRoot,srcPath)
copyExtractTree()
