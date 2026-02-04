import { useQuery } from '@tanstack/react-query'
import './App.css'
import reactLogo from './assets/react.svg'
import { apiAPIService, userAPIService } from './shared/api'
import viteLogo from '/vite.svg'

function App() {
  const {data: userList1} = useQuery({
    queryKey: ['user', 'list'],
    queryFn: () => userAPIService.getList()
  })
  const {data: userList2} = useQuery({
    queryKey: ['user', 'list'],
    queryFn: () => userAPIService.getList()
  })
  const {data: userList3} = useQuery({
    queryKey: ['user', 'list'],
    queryFn: () => userAPIService.getList()
  })
  const {data: userList4} = useQuery({
    queryKey: ['user', 'list'],
    queryFn: () => userAPIService.getList()
  })


  // test request many apis
  // expect: deduplicate api refresh token, retry the failed requests after refresh token
  // useEffect(()=>{
  //   apiAPIService.getMe()
  //   apiAPIService.getMe()
  //   apiAPIService.getMe()
  // }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={apiAPIService.redirectLogin}>
          Login
        </button>
        <button onClick={apiAPIService.refreshToken}>
          Refresh token
        </button>
        <button onClick={apiAPIService.logout}>
          Logout
        </button>
        <button onClick={apiAPIService.getMe}>
          Get me
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
