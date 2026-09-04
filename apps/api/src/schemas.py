from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    name: str
    email: str
    is_active: bool = True


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
