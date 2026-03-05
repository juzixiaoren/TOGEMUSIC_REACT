import LoginContainer from '../../components/LoginComponents/LoginContainer'
import HeaderTop from '../../components/HeaderTop/HeaderTop'
import '../../styles/base.css'
import './LoginPage.css'
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
            <div className='content'>
                <div id="loginContent" className="glass">
                    {isLoginVisible ? <LoginContainer toggleView={toggleView} /> : <RegisterContainer toggleView={toggleView} />}
                </div>
            </div>
        </div>
    )
}
