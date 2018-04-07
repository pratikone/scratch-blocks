goog.provide('Blockly.BlockTransformer');
goog.require('Blockly.RefactoringUtils');

Blockly.BlockTransformer = function(workspace) {
    this.workspace = workspace;
};

const testResp = {
  "type": "transformation",
  "body": [
    {
      "name": "tempVar1",
      "ID": "fec8d3a8-a596-4cc0-8cca-c762d380bbd4",
      "target": "_stage_",
      "type": "VarDeclareAction"
    },
    {
      "blockXML": "<xml><block type=\"data_setvariableto\" id=\"24331d30-c862-4a40-98d1-f50a3e59083a\" x=\"0\" y=\"0\"><field name=\"VARIABLE\" id=\"fec8d3a8-a596-4cc0-8cca-c762d380bbd4\" variabletype=\"\">tempVar1</field><value name=\"VALUE\"><block type=\"operator_add\" id=\"]|^dno=m}Q;s+OH0mdtb\" x=\"0\" y=\"0\"><value name=\"NUM1\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"NUM2\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value></block></value></block></xml>",
      "type": "BlockCreateAction"
    },
    {
      "targetBlock": "gbqn5F}D3e!PPSG59$+G",
      "insertedBlock": "24331d30-c862-4a40-98d1-f50a3e59083a",
      "type": "InsertBlockAction"
    },
    {
      "targetBlock": "]|^dno=m}Q;s+OH0mdtb",
      "replaceWith": "2cc8a777-9ad4-4157-b2a9-d597de0f496c",
      "type": "ReplaceAction"
    }
  ]
};

  // current structure : resp = {"type": refactoring, "body": {"type": "trasformation", "body": [{action1}, {action2}]}}
  // perhaps change to resp = {"type": "", "content": {"type": "", "trans": {}}}
Blockly.BlockTransformer.prototype.doTransform = function(resp){
    resp = resp || testResp;
    const actions = JSON.parse(resp["body"])["body"];
    for (var action of actions){
      this.apply(action);
    }
};

Blockly.BlockTransformer.prototype.apply = function(action){
  const actionType = action.type;
  this[actionType](action);
};

Blockly.BlockTransformer.prototype.VarDeclareAction = function(action){
	let varCreateJson = {
		type : "var_create",
		varType : "",
		varName : action.name,
		varId : action.ID
	};

	let varCreateEvent = new Blockly.Events.VarCreate(null);
	varCreateEvent.fromJson(varCreateJson);
	varCreateEvent.workspaceId = this.workspace.id;
	varCreateEvent.run(true);
};

// put in a temporary place in the workspace (0,0)?
Blockly.BlockTransformer.prototype.BlockCreateAction = function(action){
	let dom = Blockly.Xml.textToDom(action.blockXML).firstChild;
	let block = Blockly.Xml.domToBlock(dom, this.workspace);
};


Blockly.BlockTransformer.prototype.InsertBlockAction = function(action){
	let targetBlock = this.workspace.getBlockById(action.targetBlock);
  let insertedBlock = this.workspace.getBlockById(action.insertedBlock);
  
  //handle the case when there's a block connected to the block target
  let previousBlock = targetBlock.previousConnection.targetBlock();
  if(previousBlock){
    previousBlock.nextConnection.connect(insertedBlock.previousConnection);
  }else{
    // place inserted block close to the postion of the target block to avoid block jump
    let xy = targetBlock.getRelativeToSurfaceXY();
    insertedBlock.moveBy(xy.x, xy.y);
  }


	targetBlock.previousConnection.connect(insertedBlock.nextConnection);
	
};


Blockly.BlockTransformer.prototype.ReplaceAction = function(action){
  var targetBlock = this.workspace.getBlockById(action.targetBlock);
  var targetBlockList = action.targetBlockList;
  var replaceWith = this.workspace.getBlockById(action.replaceWith);
  // if(!targetBlock){
  // 	return;
  // }
  if(targetBlock){
    var parentConnection = targetBlock.outputConnection.targetConnection;
    targetBlock.unplug(true,true);
    parentConnection.connect(replaceWith.outputConnection);
    // delete old value
    targetBlock.dispose();
  }

  //todo handle when targetBlockList has one block to replace (e.g. if block)
  if(targetBlockList){
    var targetBlocks = [];
    for( var blockID of targetBlockList){
      targetBlocks.push(this.workspace.getBlockById(blockID));
    }

    //get previous conn of top most block
    var topmostBlock = targetBlocks[0];

    let targetBlock = topmostBlock;
    let insertedBlock = replaceWith;
    
    //handle the case when there's a block connected to the block target
    // let previousBlock = targetBlock.previousConnection.targetBlock();
    let prevConn = targetBlock.previousConnection.targetConnection;
    if(prevConn){
      prevConn.connect(insertedBlock.previousConnection);
    }else{
      // place inserted block close to the postion of the target block to avoid block jump
      let xy = targetBlock.getRelativeToSurfaceXY();
      insertedBlock.moveBy(xy.x, xy.y);
    }

    // unplug bottom block
    let lastBlock = targetBlocks[targetBlocks.length-1];
    
    // the block after the replaced fragment
    let nextBlock = lastBlock.nextConnection.targetBlock();
    if(nextBlock){
      let nextConn = lastBlock.nextConnection.targetBlock().previousConnection;
      lastBlock.unplug(); //must be unplugged before nextConn can connect to the inserted block
      insertedBlock.nextConnection.connect(nextConn);
    }

    // dispose the fragment
    while(targetBlocks.length>0){
      var toDispose = targetBlocks.pop();
      toDispose.dispose();
    }

  }

};

Blockly.BlockTransformer.prototype.DeleteAction = function(action){
  let targetBlock = this.workspace.getBlockById(action.targetBlock);
  if(!targetBlock){
    console.error("target block to delete not found");
    return; //targetBlock to delete not found; 
  }
  let previousBlock = null;
  let nextBlock = null;

  if(targetBlock.previousConnection){
    previousBlock = targetBlock.previousConnection.targetBlock();
  }
  if(targetBlock.nextConnection){
    nextBlock = targetBlock.nextConnection.targetBlock();
  }

  if(previousBlock&&nextBlock){
    previousBlock.nextConnection.connect(nextBlock.previousConnection);
  }else if(previousBlock&&!nextBlock){
    targetBlock.unplug(true,true);
  }else if(!previousBlock&&nextBlock){
    targetBlock.unplug(true,true);
  }else{ //just a block target
    //no connection adjustment required
  }

  targetBlock.dispose();

};
