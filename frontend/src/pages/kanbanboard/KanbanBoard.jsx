import React, { useEffect, useState } from 'react'
import BoardColumn from './BoardColumn';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import Board from './Board';
import TaskBoardSkeleton from '../../components/loading/TaskBoardSkeleton';
import { useParams } from 'react-router';
import { useBoard } from '../../hooks/api/useBoards';
import { useBoardTasksQuery } from '../../hooks/useTaskListQueries';


let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"Education",
    color:"text-red-500",
    ref:""
  },
  {
    name:"Upper Egypt Education",
    color:"text-slate-800",
    ref:""
  },
]
const KanbanBoard = ({setPath}) => {
  const [activeTab, setActiveTab] = useState("board");
  const [loading, setLoading] = useState(true);
  const {boardId} = useParams();

  const {data: boardData, isLoading: boardLoading, isError: boardError} = useBoard(boardId);
  const {data:boardTasks, isLoading: boardTasksLoading, isError: boardTasksError} = useBoardTasksQuery(boardId);
  const {columns} = boardData || {columns: []};
  useEffect(() => {console.log(boardTasks)}, [boardTasks]);

  useEffect(() => {
    setPath(path);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <Toolbar />
        <TaskBoardSkeleton />
      </div>
    );
  }
  return (
    <div className='flex flex-col overflow-hidden'>
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <Toolbar />
      <Board id={boardId} columns={columns} />
    </div>
    
  );
  
}

export default KanbanBoard
