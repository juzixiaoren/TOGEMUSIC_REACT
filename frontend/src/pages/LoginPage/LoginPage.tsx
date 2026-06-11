import LoginContainer from '../../components/LoginComponents/LoginContainer'
import HeaderTop from '../../components/HeaderTop/HeaderTop'
import RegisterContainer from '../../components/RegisterComponents/RegisterContainer'
import { useState } from 'react'

export default function LoginPage() {
    const [isLoginVisible, setIsLoginVisible] = useState(true);
    const toggleView = () => {
        setIsLoginVisible(!isLoginVisible);
    };
    return (
        <div>
            <HeaderTop isLogin={false} />
            <div className='content group'>
                <div className="glass w-[50vw] min-w-[500px] h-auto absolute flex flex-col justify-center py-[60px] px-0 pb-[50px] top-[30vh] scale-90 transition-transform duration-500 ease-[cubic-bezier(0,.68,.12,1)] group-hover:scale-100">
                    {isLoginVisible ? <LoginContainer toggleView={toggleView} /> : <RegisterContainer toggleView={toggleView} />}
                </div>
            </div>
        </div>
    )
}
